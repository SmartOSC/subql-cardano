// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { isMainThread } from 'worker_threads';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PoiService,
  PoiSyncService,
  BaseProjectService,
  StoreService,
  NodeConfig,
  IProjectUpgradeService,
  profiler,
  exitWithError,
  getLogger,
} from '@subql/node-core';
import { CardanoDatasource } from '@subql/types';
import { Sequelize } from '@subql/x-sequelize';
import { SubqueryProject } from '../configure/SubqueryProject';
import { ApiService } from './api.service';
import { DsProcessorService } from './ds-processor.service';
import { DynamicDsService } from './dynamic-ds.service';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';
import { getStartChainPoint } from '../utils/project';
import { CardanoCustomDataSource } from '@subql/common-substrate';
import { IChainTipSchema } from '../utils/cache';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: packageVersion } = require('../../package.json');

@Injectable()
export class ProjectService extends BaseProjectService<
  ApiService,
  CardanoDatasource
> {
  protected packageVersion = packageVersion;

  constructor(
    dsProcessorService: DsProcessorService,
    apiService: ApiService,
    @Inject(isMainThread ? PoiService : 'Null') poiService: PoiService,
    @Inject(isMainThread ? PoiSyncService : 'Null')
    poiSyncService: PoiSyncService,
    @Inject(isMainThread ? Sequelize : 'Null') sequelize: Sequelize,
    @Inject('ISubqueryProject') project: SubqueryProject,
    @Inject('IProjectUpgradeService')
    projectUpgradeService: IProjectUpgradeService<SubqueryProject>,
    @Inject(isMainThread ? StoreService : 'Null') storeService: StoreService,
    nodeConfig: NodeConfig,
    dynamicDsService: DynamicDsService,
    eventEmitter: EventEmitter2,
    unfinalizedBlockService: UnfinalizedBlocksService,
  ) {
    super(
      dsProcessorService,
      apiService,
      poiService,
      poiSyncService,
      sequelize,
      project,
      projectUpgradeService,
      storeService,
      nodeConfig,
      dynamicDsService,
      eventEmitter,
      unfinalizedBlockService,
    );
  }

  @profiler()
  async init(startHeight?: number): Promise<void> {
    return super.init(startHeight);
  }

  protected async getBlockTimestamp(height: number): Promise<Date> {
    // TODO: implement call to cardano util
    // const block = await getBlockByHeight(this.apiService.api, height);
    // return getTimestamp(block);

    return new Date();
  }

  protected onProjectChange(project: SubqueryProject): void | Promise<void> {
    this.apiService.updateBlockFetching();
  }

  // @ts-ignore
  getStartChainPointFromDataSources(): IChainTipSchema {
    try {
      return getStartChainPoint(
        this.project.dataSources as unknown as CardanoCustomDataSource[],
      );
    } catch (e: any) {
      exitWithError(e, getLogger('Project'));
    }
  }
}
