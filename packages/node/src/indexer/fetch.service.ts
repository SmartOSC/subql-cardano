// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApiPromise } from '@polkadot/api';

import { isCustomDs, SubstrateHandlerKind } from '@subql/common-substrate';
import {
  NodeConfig,
  BaseFetchService,
  getModulos,
  Header,
} from '@subql/node-core';
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

const BLOCK_TIME_VARIANCE = 5000; //ms
const INTERVAL_PERCENT = 0.9;

@Injectable()
export class FetchService extends BaseFetchService<
  SubstrateDatasource,
  ISubstrateBlockDispatcher,
  SubstrateBlock
> {
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
}
