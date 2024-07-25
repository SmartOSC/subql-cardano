// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Injectable } from '@nestjs/common';
import { ApiPromise } from '@polkadot/api';
import { RuntimeVersion } from '@polkadot/types/interfaces';
import {
  isBlockHandlerProcessor,
  isCallHandlerProcessor,
  isEventHandlerProcessor,
  isCustomDs,
  isRuntimeDs,
  SubstrateCustomDataSource,
  SubstrateHandlerKind,
  SubstrateRuntimeHandlerInputMap,
} from '@subql/common-substrate';
import {
  NodeConfig,
  profiler,
  SandboxService,
  IndexerSandbox,
  ProcessBlockResponse,
  BaseIndexerManager,
  IBlock,
} from '@subql/node-core';
import {
  LightSubstrateEvent,
  SubstrateBlock,
  SubstrateBlockFilter,
  SubstrateDatasource,
  SubstrateEvent,
  SubstrateExtrinsic,
} from '@subql/types';
import { SubstrateProjectDs } from '../configure/SubqueryProject';
import * as SubstrateUtil from '../utils/substrate';
import { ApiService as CardanoApiService } from './api.service';
import { DsProcessorService } from './ds-processor.service';
import { DynamicDsService } from './dynamic-ds.service';
import {
  ApiAt,
  BlockContent,
  CardanoBlockContent,
  isFullBlock,
  LightBlockContent,
} from './types';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';
import { CardanoSafeClient } from './cardano/cardanoClient.connection';
import { CardanoClient } from './cardano/CardanoClient';
import { MultiEraBlock as CardanoBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';

@Injectable()
export class IndexerManager extends BaseIndexerManager<
  CardanoClient,
  CardanoSafeClient,
  CardanoBlockContent | LightBlockContent,
  CardanoApiService,
  SubstrateDatasource,
  SubstrateCustomDataSource,
  typeof FilterTypeMap,
  typeof ProcessorTypeMap,
  SubstrateRuntimeHandlerInputMap
> {
  protected isRuntimeDs = isRuntimeDs;
  protected isCustomDs = isCustomDs;

  constructor(
    apiService: CardanoApiService,
    nodeConfig: NodeConfig,
    sandboxService: SandboxService<CardanoClient, CardanoSafeClient>,
    dsProcessorService: DsProcessorService,
    dynamicDsService: DynamicDsService,
    unfinalizedBlocksService: UnfinalizedBlocksService,
  ) {
    super(
      apiService,
      nodeConfig,
      sandboxService,
      dsProcessorService,
      dynamicDsService,
      unfinalizedBlocksService,
      FilterTypeMap,
      ProcessorTypeMap,
    );
  }

  @profiler()
  async indexBlock(
    block: IBlock<CardanoBlockContent | LightBlockContent>,
    dataSources: SubstrateDatasource[],
    runtimeVersion?: RuntimeVersion,
  ): Promise<ProcessBlockResponse> {
    return super.internalIndexBlock(block, dataSources, () =>
      this.getApi(block.block, runtimeVersion),
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getApi(
    block: LightBlockContent | CardanoBlockContent,
    runtimeVersion?: RuntimeVersion,
  ): Promise<CardanoClient> {
    // return this.apiService.getPatchedApi(
    //   block.block.block.header,
    //   runtimeVersion,
    // );
    // TODO: implement
    return this.apiService.getSafeApi(0);
  }

  protected async indexBlockData(
    blockContent: LightBlockContent | CardanoBlockContent,
    dataSources: SubstrateProjectDs[],
    getVM: (d: SubstrateProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    if (isFullBlock(blockContent)) {
      const { block, events } = blockContent;
      await this.indexBlockContent(block, dataSources, getVM);

      // Run initialization events
      // const initEvents = events.filter((evt) => evt.phase.isInitialization);
      // for (const event of initEvents) {
      //   await this.indexEvent(event, dataSources, getVM);
      // }

      // for (const extrinsic of extrinsics) {
      //   await this.indexExtrinsic(extrinsic, dataSources, getVM);

      //   // Process extrinsic events
      //   const extrinsicEvents = events
      //     .filter((e) => e.extrinsic?.idx === extrinsic.idx)
      //     .sort((a, b) => a.idx - b.idx);

      //   for (const event of extrinsicEvents) {
      //     await this.indexEvent(event, dataSources, getVM);
      //   }
      // }

      // Run finalization events
      const finalizeEvents = events.filter((evt) => evt.phase.isFinalization);
      for (const event of finalizeEvents) {
        await this.indexEvent(event, dataSources, getVM);
      }
    } else {
      // for (const event of blockContent.events) {
      //   await this.indexEvent(event, dataSources, getVM);
      // }
    }
  }

  private async indexBlockContent(
    block: CardanoBlock,
    dataSources: SubstrateProjectDs[],
    getVM: (d: SubstrateProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    for (const ds of dataSources) {
      await this.indexData(SubstrateHandlerKind.CardanoBlock, block, ds, getVM);
    }
  }

  private async indexExtrinsic(
    extrinsic: SubstrateExtrinsic,
    dataSources: SubstrateProjectDs[],
    getVM: (d: SubstrateProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    for (const ds of dataSources) {
      await this.indexData(SubstrateHandlerKind.Call, extrinsic, ds, getVM);
    }
  }

  private async indexEvent(
    event: SubstrateEvent | LightSubstrateEvent,
    dataSources: SubstrateProjectDs[],
    getVM: (d: SubstrateProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    for (const ds of dataSources) {
      await this.indexData(SubstrateHandlerKind.Event, event, ds, getVM);
    }
  }

  protected async prepareFilteredData<T = any>(
    kind: SubstrateHandlerKind,
    data: T,
  ): Promise<T> {
    // Substrate doesn't need to do anything here
    return Promise.resolve(data);
  }
}

const ProcessorTypeMap = {
  [SubstrateHandlerKind.Block]: isBlockHandlerProcessor,
  [SubstrateHandlerKind.CardanoBlock]: isBlockHandlerProcessor,
  [SubstrateHandlerKind.Event]: isEventHandlerProcessor,
  [SubstrateHandlerKind.Call]: isCallHandlerProcessor,
};

const FilterTypeMap = {
  [SubstrateHandlerKind.Block]: (
    block: SubstrateBlock,
    filter?: SubstrateBlockFilter,
  ) => !!SubstrateUtil.filterBlock(block, filter),
  [SubstrateHandlerKind.CardanoBlock]: (
    block: SubstrateBlock,
    filter?: SubstrateBlockFilter,
  ) => !!SubstrateUtil.filterBlock(block, filter),
  [SubstrateHandlerKind.Event]: SubstrateUtil.filterEvent,
  [SubstrateHandlerKind.Call]: SubstrateUtil.filterExtrinsic,
};
