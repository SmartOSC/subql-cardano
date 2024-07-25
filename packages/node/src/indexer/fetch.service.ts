// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApiPromise } from '@polkadot/api';

import { isCustomDs, SubstrateHandlerKind } from '@subql/common-substrate';
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
import { SubstrateDatasource, SubstrateBlock } from '@subql/types';
import { SubqueryProject } from '../configure/SubqueryProject';
import { substrateHeaderToHeader } from '../utils/substrate';
import { ApiService } from './api.service';
import { ISubstrateBlockDispatcher } from './blockDispatcher/substrate-block-dispatcher';
import { SubstrateDictionaryService } from './dictionary/substrateDictionary.service';
import { ProjectService } from './project.service';
import { RuntimeService } from './runtime/runtimeService';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';
import { calcInterval } from '../utils/cardano';
import { CardanoClient } from './cardano/CardanoClient';
import assert from 'assert';
import { range, without } from 'lodash';
import { RedisCachingService } from '../caching/redis-caching.service';

const BLOCK_TIME_VARIANCE = 5000; //ms
const INTERVAL_PERCENT = 0.9;
const logger = getLogger('CardanoFetchService');

@Injectable()
export class FetchService
  extends BaseFetchService<
    SubstrateDatasource,
    ISubstrateBlockDispatcher,
    SubstrateBlock
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
    blockDispatcher: ISubstrateBlockDispatcher,
    dictionaryService: SubstrateDictionaryService,
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

  protected getModulos(dataSources: SubstrateDatasource[]): number[] {
    return getModulos(dataSources, isCustomDs, SubstrateHandlerKind.Block);
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
      ? this._latestBestHeightTmp ?? 0
      : this._latestFinalizedHeightTmp ?? 0;
  }

  async getBestBlockHead(): Promise<void> {
    super.getBestBlockHead();
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
    value: SubstrateDatasource[];
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
      if (
        !this._validSequentialBlock(
          startBlockHeight,
          startBlockHeight + scaledBatchSize - 1,
        )
      ) {
        logger.debug(`Queue not found point height`);
        continue;
      }
      if (
        this.blockDispatcher.freeSize < scaledBatchSize ||
        startBlockHeight > latestHeight
      ) {
        if (this.blockDispatcher.freeSize < scaledBatchSize) {
          logger.debug(
            `Fetch service is waiting for free space in the block dispatcher queue, free size: ${this.blockDispatcher.freeSize}, scaledBatchSize: ${scaledBatchSize}`,
          );
        }
        if (startBlockHeight > latestHeight) {
          logger.debug(
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
      `block-${startBlockHeight}`,
    );
    if (!existedStartBlockHeight) return false;

    const existedEndBlockHeight = await this.redisCaching.get(
      `block-${endBlockHeight}`,
    );
    if (!existedEndBlockHeight) return false;

    return true;
  }

  private async _enqueueBlocks(
    enqueuingBlocks: (IBlock<SubstrateBlock> | number)[],
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
    cleanedBatchBlocks: (IBlock<SubstrateBlock> | number)[],
    rawBatchBlocks: (IBlock<SubstrateBlock> | number)[],
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
    currentBatchBlocks: (number | IBlock<SubstrateBlock>)[],
  ): (number | IBlock<SubstrateBlock>)[] {
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
    super.getFinalizedBlockHead();
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
}
