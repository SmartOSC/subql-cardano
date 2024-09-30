// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ApiPromise } from '@polkadot/api';

import { isCustomDs, CardanoHandlerKind } from '@subql/common-cardano';
import {
  NodeConfig,
  BaseFetchService,
  getModulos,
  Header,
  getLogger,
  delay,
  mergeNumAndBlocks,
  waitForBatchSize,
  IndexerEvent,
  IBlock,
  mergeNumAndBlocksToNums,
  cleanedBatchBlocks,
  getBlockHeight,
  transformBypassBlocks,
} from '@subql/node-core';
import util from 'util';
import { CardanoDatasource, CardanoBlock } from '@subql/types';
import { SubqueryProject } from '../configure/SubqueryProject';
import { ApiService } from './api.service';
import { ICardanoBlockDispatcher } from './blockDispatcher/cardano-block-dispatcher';
import { CardanoDictionaryService } from './dictionary/cardanoDictionary.service';
import { ProjectService } from './project.service';
import { RuntimeService } from './runtime/runtimeService';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';
import { calcInterval } from '../utils/cardano';
import { CardanoClient } from './cardano/CardanoClient';
import assert from 'assert';
import { range, without } from 'lodash';
import { RedisCachingService } from '../caching/redis-caching.service';
import {
  IChainPoint,
  IChainTip,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import { fromHex, toHex } from './utils/hex';
import { IChainPointSchema, IChainTipSchema, redis } from '../utils/cache';

const BLOCK_TIME_VARIANCE = 5000; //ms
const INTERVAL_PERCENT = 0.9;
const logger = getLogger('CardanoFetchService');
const wokerLogger = getLogger('WorkerSyncCardano');
@Injectable()
export class FetchService
  extends BaseFetchService<
    CardanoDatasource,
    ICardanoBlockDispatcher,
    CardanoBlock
  >
  implements OnApplicationShutdown
{
  private _eventEmitter: EventEmitter2;
  private _isShutdown = false;
  private _schedulerRegistry: SchedulerRegistry;
  private _nodeConfig: NodeConfig;
  private _latestBestHeightTmp?: number;
  private _latestFinalizedHeightTmp?: number;
  private _bypassBlocks: number[] = [];

  constructor(
    private apiService: ApiService,
    nodeConfig: NodeConfig,
    @Inject('IProjectService') projectService: ProjectService,
    @Inject('ISubqueryProject') project: SubqueryProject,
    @Inject('IBlockDispatcher')
    blockDispatcher: ICardanoBlockDispatcher,
    dictionaryService: CardanoDictionaryService,
    unfinalizedBlocksService: UnfinalizedBlocksService,
    eventEmitter: EventEmitter2,
    schedulerRegistry: SchedulerRegistry,
    private runtimeService: RuntimeService,
    @Inject(RedisCachingService)
    private readonly redisCaching: RedisCachingService,
  ) {
    super(
      nodeConfig,
      projectService,
      project.network,
      blockDispatcher,
      dictionaryService,
      eventEmitter,
      schedulerRegistry,
      unfinalizedBlocksService,
    );

    // Init custom field
    this._eventEmitter = eventEmitter;
    this._schedulerRegistry = schedulerRegistry;
    this._nodeConfig = nodeConfig;
  }

  onApplicationShutdown(): void {
    try {
      this._schedulerRegistry.deleteInterval('getFinalizedBlockHead');
      this._schedulerRegistry.deleteInterval('getBestBlockHead');
    } catch (e) {
      //ignore if interval not exist
    }
    this._isShutdown = true;

    redis.del(`number_of_cron_job_process`);
    redis.del(`number_of_socket`);
  }

  get api(): CardanoClient {
    return this.apiService.unsafeApi;
  }

  protected async getFinalizedHeader(): Promise<Header> {
    return this.api.getHeader();
  }

  protected async getBestHeight(): Promise<number> {
    return (await this.api.getHeader()).blockHeight;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getChainInterval(): Promise<number> {
    const chainInterval = calcInterval(this.api);

    return Math.min(BLOCK_TIME_VARIANCE, chainInterval);
  }

  protected getModulos(dataSources: CardanoDatasource[]): number[] {
    return getModulos(dataSources, isCustomDs, CardanoHandlerKind.Block);
  }

  protected async initBlockDispatcher(): Promise<void> {
    await this.blockDispatcher.init(
      this.resetForNewDs.bind(this),
      this.runtimeService,
    );
  }

  protected async preLoopHook({
    startHeight,
  }: {
    startHeight: number;
  }): Promise<void> {
    this.runtimeService.init(this.getLatestFinalizedHeight.bind(this));

    await this.runtimeService.syncDictionarySpecVersions(startHeight);

    // setup parentSpecVersion
    await this.runtimeService.specChanged(startHeight);
    await this.runtimeService.prefetchMeta(startHeight);
  }

  private _latestHeight(): number {
    return this._nodeConfig.unfinalizedBlocks
      ? (this._latestBestHeightTmp ?? 0)
      : (this._latestFinalizedHeightTmp ?? 0);
  }

  async getBestBlockHead(): Promise<void> {
    await super.getBestBlockHead();
    // customize
    try {
      const currentBestHeight = await this.getBestHeight();
      if (this._latestBestHeightTmp !== currentBestHeight) {
        this._latestBestHeightTmp = currentBestHeight;
      }
    } catch (e: any) {
      logger.error(e, `Having a problem when getting best block`);
    }
  }

  private _getRelevantDsDetails(startBlockHeight: number): {
    endHeight: number | undefined;
    value: CardanoDatasource[];
  } {
    const details = this.projectService
      .getDataSourcesMap()
      .getDetails(startBlockHeight);
    assert(details, `Datasources not found for height ${startBlockHeight}`);
    return { endHeight: details.endHeight, value: details.value };
  }

  // get all modulo numbers with a specific block ranges
  private _getModuloBlocks(startHeight: number, endHeight: number): number[] {
    // Find relevant ds
    const { endHeight: rangeEndHeight, value: relevantDS } =
      this._getRelevantDsDetails(startHeight);
    const moduloNumbers = this.getModulos(relevantDS);
    // no modulos in the filters been found in current ds
    if (!moduloNumbers.length) return [];
    const maxModulosBlockHeight =
      this._nodeConfig.batchSize * Math.max(...moduloNumbers) + startHeight;
    const moduloEndHeight = Math.min(
      rangeEndHeight ?? Number.MAX_SAFE_INTEGER,
      maxModulosBlockHeight,
      endHeight,
    );
    const moduloBlocks: number[] = [];
    for (let i = startHeight; i <= moduloEndHeight; i++) {
      if (moduloNumbers.find((m) => i % m === 0)) {
        moduloBlocks.push(i);
      }
    }
    return moduloBlocks;
  }

  async fillNextBlockBuffer(initBlockHeight: number): Promise<void> {
    let startBlockHeight: number;
    let scaledBatchSize: number;

    const getStartBlockHeight = (): number => {
      return this.blockDispatcher.latestBufferedHeight
        ? this.blockDispatcher.latestBufferedHeight + 1
        : initBlockHeight;
    };

    while (!this._isShutdown) {
      startBlockHeight = getStartBlockHeight();

      scaledBatchSize = this.blockDispatcher.smartBatchSize;

      if (scaledBatchSize === 0) {
        await waitForBatchSize(this.blockDispatcher.minimumHeapLimit);
        continue;
      }

      const latestHeight = this._latestHeight();
      const validBlockRange = await this._validSequentialBlock(
        startBlockHeight,
        startBlockHeight + scaledBatchSize - 1,
      );
      if (!validBlockRange) {
        logger.warn(
          `Queue not found chain point with range ${startBlockHeight} - ${startBlockHeight + scaledBatchSize - 1}`,
        );
        await delay(10);
        continue;
      }
      if (
        this.blockDispatcher.freeSize < scaledBatchSize ||
        startBlockHeight > latestHeight
      ) {
        if (this.blockDispatcher.freeSize < scaledBatchSize) {
          logger.error(
            `Fetch service is waiting for free space in the block dispatcher queue, free size: ${this.blockDispatcher.freeSize}, scaledBatchSize: ${scaledBatchSize}`,
          );
        }
        if (startBlockHeight > latestHeight) {
          logger.error(
            `Fetch service is waiting for new blocks, startBlockHeight: ${startBlockHeight}, latestHeight: ${latestHeight}`,
          );
        }
        await delay(1);
        continue;
      }

      // This could be latestBestHeight, dictionary should never include finalized blocks
      // TODO add buffer so dictionary not used when project synced
      if (
        startBlockHeight <
        (this._latestBestHeightTmp ?? 0) - scaledBatchSize
      ) {
        // if (startBlockHeight < this.latestFinalizedHeight) {
        try {
          const dictionary =
            await this.dictionaryService.scopedDictionaryEntries(
              startBlockHeight,
              scaledBatchSize,
              this._latestFinalizedHeightTmp ?? 0,
            );

          if (startBlockHeight !== getStartBlockHeight()) {
            logger.debug(
              `Queue was reset for new DS, discarding dictionary query result`,
            );
            continue;
          }
          if (dictionary) {
            const { batchBlocks } = dictionary;
            // the last block returned from batch should have max height in this batch
            const mergedBlocks = mergeNumAndBlocks(
              this._getModuloBlocks(
                startBlockHeight,
                dictionary.lastBufferedHeight,
              ),
              batchBlocks,
            );
            if (mergedBlocks.length === 0) {
              // There we're no blocks in this query range, we can set a new height we're up to
              await this._enqueueBlocks([], dictionary.lastBufferedHeight);
            } else {
              const maxBlockSize = Math.min(
                mergedBlocks.length,
                this.blockDispatcher.freeSize,
              );
              const enqueueBlocks = mergedBlocks.slice(0, maxBlockSize);
              await this._enqueueBlocks(enqueueBlocks, latestHeight);
            }
            continue; // skip nextBlockRange() way
          } else {
            await this.enqueueSequential(
              startBlockHeight,
              scaledBatchSize,
              latestHeight,
            );
          }
        } catch (e: any) {
          logger.debug(`Fetch dictionary stopped: ${e.message}`);
          this._eventEmitter.emit(IndexerEvent.SkipDictionary);
          await this.enqueueSequential(
            startBlockHeight,
            scaledBatchSize,
            latestHeight,
          );
        }
      } else {
        await this.enqueueSequential(
          startBlockHeight,
          scaledBatchSize,
          latestHeight,
        );
      }
    }
  }

  private async _validSequentialBlock(
    startBlockHeight: number,
    endBlockHeight: number,
  ): Promise<boolean> {
    const existedStartBlockHeight = await this.redisCaching.get(
      `smart:cache:block-${startBlockHeight}`,
    );
    if (!existedStartBlockHeight) return false;

    const existedEndBlockHeight = await this.redisCaching.get(
      `smart:cache:block-${endBlockHeight}`,
    );
    if (!existedEndBlockHeight) return false;

    return true;
  }

  private async _enqueueBlocks(
    enqueuingBlocks: (IBlock<CardanoBlock> | number)[],
    latestHeight: number,
  ): Promise<void> {
    const cleanedBatchBlocks = this._filteredBlockBatch(enqueuingBlocks);
    await this.blockDispatcher.enqueueBlocks(
      cleanedBatchBlocks,
      this._getLatestBufferHeight(
        cleanedBatchBlocks,
        enqueuingBlocks,
        latestHeight,
      ),
    );
  }

  /**
   *
   * @param cleanedBatchBlocks
   * @param rawBatchBlocks
   * @param latestHeight
   * @private
   */
  private _getLatestBufferHeight(
    cleanedBatchBlocks: (IBlock<CardanoBlock> | number)[],
    rawBatchBlocks: (IBlock<CardanoBlock> | number)[],
    latestHeight: number,
  ): number {
    // When both BatchBlocks are empty, mean no blocks to enqueue and full synced,
    // we are safe to update latestBufferHeight to this number
    if (cleanedBatchBlocks.length === 0 && rawBatchBlocks.length === 0) {
      return latestHeight;
    }
    return Math.max(
      ...mergeNumAndBlocksToNums(cleanedBatchBlocks, rawBatchBlocks),
    );
  }

  private _filteredBlockBatch(
    currentBatchBlocks: (number | IBlock<CardanoBlock>)[],
  ): (number | IBlock<CardanoBlock>)[] {
    if (!this._bypassBlocks.length || !currentBatchBlocks) {
      return currentBatchBlocks;
    }

    const cleanedBatch = cleanedBatchBlocks(
      this._bypassBlocks,
      currentBatchBlocks,
    );

    const pollutedBlocks = this._bypassBlocks.filter(
      (b) => b < Math.max(...currentBatchBlocks.map((b) => getBlockHeight(b))),
    );
    if (pollutedBlocks.length) {
      // inspect limits the number of logged blocks to 100
      logger.info(
        `Bypassing blocks: ${util.inspect(pollutedBlocks, { maxArrayLength: 100 })}`,
      );
    }
    this._bypassBlocks = without(this._bypassBlocks, ...pollutedBlocks);
    return cleanedBatch;
  }

  async init(startHeight: number): Promise<void> {
    this._bypassBlocks = [];
    if (this.networkConfig?.bypassBlocks !== undefined) {
      this._bypassBlocks = transformBypassBlocks(
        this.networkConfig.bypassBlocks,
      ).filter((blk) => blk >= startHeight);
    }

    this._updateBypassBlocksFromDatasources();
    await Promise.all([this.getFinalizedBlockHead(), this.getBestBlockHead()]);

    super.init(startHeight);
  }

  async getFinalizedBlockHead(): Promise<void> {
    await super.getFinalizedBlockHead();
    // customize
    const currentFinalizedHeader = await this.getFinalizedHeader();
    if (
      this._latestFinalizedHeightTmp === undefined ||
      currentFinalizedHeader.blockHeight > this._latestFinalizedHeightTmp
    ) {
      this._latestFinalizedHeightTmp = currentFinalizedHeader.blockHeight;
    }
  }

  private _updateBypassBlocksFromDatasources(): void {
    const datasources = this.projectService.getDataSourcesMap().getAll();

    const heights = Array.from(datasources.keys());

    for (let i = 0; i < heights.length - 1; i++) {
      const currentHeight = heights[i];
      const nextHeight = heights[i + 1];

      const currentDS = datasources.get(currentHeight);
      // If the value for the current height is an empty array, then it's a gap
      if (currentDS && currentDS.length === 0) {
        this._bypassBlocks.push(...range(currentHeight, nextHeight));
      }
    }
  }

  runWorkerFetchChainPoint(startPoint?: IChainTipSchema) {
    const recoverTimeoutId = setTimeout(() => {
      logger.error('Recover Worker Fetch Chain Point From Cardano Timeout!');
      this.runWorkerFetchChainPoint(startPoint);
    }, 100000);

    setTimeout(() => {
      Promise.all([
        this.handlerGetAndCacheChainTipCardano(startPoint, recoverTimeoutId),
      ]);
    }, 1000);
  }

  async handlerGetAndCacheChainTipCardano(
    startPointFromDs?: IChainTipSchema,
    recoverTimeoutId?: NodeJS.Timeout,
  ): Promise<void> {
    wokerLogger.info('Fetch Chain Point From Cardano Starting...');

    let chainTipStart: IChainTipSchema =
      await this.getCurrentStartPoint(startPointFromDs);
    try {
      const startPoint: IChainPoint = {
        blockHeader: {
          hash: fromHex(chainTipStart.point.blockHeader?.hash ?? ''),
          slotNumber: BigInt(chainTipStart.point.blockHeader?.slotNumber ?? 0),
        },
      };

      // const MAX_SYNC_BATCH_SIZE = this.blockDispatcher.smartBatchSize;
      const BLOCK_CONFIRMATIONS = 10;
      const MAX_SYNC_BATCH_SIZE = 30;
      const latestHeight = this._latestHeight() - BLOCK_CONFIRMATIONS;
      if (latestHeight <= 0) return;

      const latestBlockRange = latestHeight - Number(chainTipStart.blockNo);
      const scaleBatchSize =
        latestBlockRange > MAX_SYNC_BATCH_SIZE
          ? MAX_SYNC_BATCH_SIZE
          : latestBlockRange;

      const nexts = chainTipStart.blockNo
        ? await this.apiService.api.requestNextPointFromStart(
            startPoint,
            scaleBatchSize,
          )
        : await this.apiService.api.requestNextPoint(scaleBatchSize);

      for (const next of nexts) {
        if (BigInt(next.blockNo) < BigInt(chainTipStart.blockNo)) continue;

        chainTipStart = {
          point: {
            blockHeader: {
              hash: toHex(next.point.blockHeader?.hash ?? new Uint8Array()),
              slotNumber: next.point.blockHeader?.slotNumber.toString() ?? '',
            },
          },
          blockNo: next.blockNo.toString(),
        };

        const key = `smart:cache:block-${next.blockNo.toString()}`;
        const value = JSON.stringify(chainTipStart);

        await this.redisCaching.set<string>(key, value, {
          ttl: 8 * 60 * 60, // 1 day
        });
        await this.redisCaching.set('startPoint', value, {
          ttl: 10 * 365 * 24 * 60 * 60,
        });

        wokerLogger.info(
          `Fetch Chain Point From Cardano Height = ${next.blockNo.toString()} Successful!`,
        );
      }
    } catch (error) {
      wokerLogger.error(`Fetch Chain Point From Cardano ERR: ${error}`);
    } finally {
      if (recoverTimeoutId) clearTimeout(recoverTimeoutId);
      this.runWorkerFetchChainPoint(chainTipStart);
    }
  }

  async getCurrentStartPoint(
    startPointFromDs?: IChainTipSchema,
  ): Promise<IChainTipSchema> {
    const startPointInCached = await this.redisCaching.get('startPoint');
    let chainTipStart: IChainTipSchema = {
      point: {
        blockHeader: {
          hash: startPointFromDs?.point.blockHeader?.hash ?? '',
          slotNumber: startPointFromDs?.point.blockHeader?.slotNumber ?? '',
        },
      },
      blockNo: startPointFromDs?.blockNo ?? '',
    };

    if (startPointInCached) {
      chainTipStart = JSON.parse(startPointInCached) as IChainTipSchema;
    }
    while (true) {
      // wokerLogger.info('Check caching ...');
      const cached = await this.redisCaching.get(
        `smart:cache:block-${(BigInt(chainTipStart.blockNo) + 1n).toString()}`,
      );
      if (!cached) break;

      chainTipStart = JSON.parse(cached) as unknown as IChainTipSchema;
    }
    await this.redisCaching.set('startPoint', JSON.stringify(chainTipStart), {
      ttl: 10 * 365 * 24 * 60 * 60,
    });

    return chainTipStart;
  }
}
