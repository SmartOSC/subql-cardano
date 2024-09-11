// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Injectable } from '@nestjs/common';
import { ApiPromise } from '@polkadot/api';
import { RuntimeVersion } from '@polkadot/types/interfaces';
import {
  isBlockHandlerProcessor,
  isCallHandlerProcessor,
  // isEventHandlerProcessor,
  isCustomDs,
  isRuntimeDs,
  CardanoCustomDataSource,
  CardanoHandlerKind,
  CardanoRuntimeHandlerInputMap,
} from '@subql/common-cardano';
import {
  NodeConfig,
  profiler,
  SandboxService,
  IndexerSandbox,
  ProcessBlockResponse,
  BaseIndexerManager,
  IBlock,
  getLogger,
} from '@subql/node-core';
import {
  LightCardanoEvent,
  CardanoBlock,
  CardanoBlockFilter,
  CardanoDatasource,
  CardanoEvent,
  CardanoExtrinsic,
} from '@subql/types';
import { CardanoProjectDs } from '../configure/SubqueryProject';
import * as CardanoUtil from '../utils/cardano';
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
// import { MultiEraBlock as CardanoBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { CustomSandboxService } from './customSandbox.service';

const logger = getLogger('indexer');
@Injectable()
export class IndexerManager extends BaseIndexerManager<
  CardanoClient,
  CardanoSafeClient,
  CardanoBlockContent | LightBlockContent,
  CardanoApiService,
  CardanoDatasource,
  CardanoCustomDataSource,
  typeof FilterTypeMap,
  typeof ProcessorTypeMap,
  CardanoRuntimeHandlerInputMap
> {
  protected isRuntimeDs = isRuntimeDs;
  protected isCustomDs = isCustomDs;

  constructor(
    apiService: CardanoApiService,
    nodeConfig: NodeConfig,
    sandboxService: CustomSandboxService,
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
    dataSources: CardanoDatasource[],
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
    dataSources: CardanoProjectDs[],
    getVM: (d: CardanoProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    if (isFullBlock(blockContent)) {
      const {
        block: { cborHexBlock },
        // events,
      } = blockContent;
      await this.indexBlockContent(cborHexBlock, dataSources, getVM);

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
      // const finalizeEvents = events.filter((evt) => evt.phase.isFinalization);
      // for (const event of finalizeEvents) {
      //   await this.indexEvent(event, dataSources, getVM);
      // }
    } else {
      // for (const event of blockContent.events) {
      //   await this.indexEvent(event, dataSources, getVM);
      // }
    }
  }

  private async indexBlockContent(
    block: string,
    dataSources: CardanoProjectDs[],
    getVM: (d: CardanoProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    for (const ds of dataSources) {
      await this.indexData(CardanoHandlerKind.Block, block, ds, getVM);
    }
  }

  private async indexExtrinsic(
    extrinsic: CardanoExtrinsic,
    dataSources: CardanoProjectDs[],
    getVM: (d: CardanoProjectDs) => Promise<IndexerSandbox>,
  ): Promise<void> {
    for (const ds of dataSources) {
      await this.indexData(CardanoHandlerKind.Call, extrinsic, ds, getVM);
    }
  }

  // private async indexEvent(
  //   event: SubstrateEvent | LightSubstrateEvent,
  //   dataSources: SubstrateProjectDs[],
  //   getVM: (d: SubstrateProjectDs) => Promise<IndexerSandbox>,
  // ): Promise<void> {
  //   for (const ds of dataSources) {
  //     await this.indexData(CardanoHandlerKind.Event, event, ds, getVM);
  //   }
  // }

  protected async prepareFilteredData<T = any>(
    kind: CardanoHandlerKind,
    data: T,
  ): Promise<T> {
    // Substrate doesn't need to do anything here
    return Promise.resolve(data);
  }
}

const ProcessorTypeMap = {
  [CardanoHandlerKind.Block]: isBlockHandlerProcessor,
  // [CardanoHandlerKind.CardanoBlock]: isBlockHandlerProcessor,
  [CardanoHandlerKind.Call]: isCallHandlerProcessor,
};

const FilterTypeMap = {
  [CardanoHandlerKind.Block]: (
    block: CardanoBlock,
    filter?: CardanoBlockFilter,
  ) => !!CardanoUtil.filterBlock(block, filter),
  [CardanoHandlerKind.Call]: CardanoUtil.filterExtrinsic,
};
