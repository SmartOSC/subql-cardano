// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PoiBenchmarkService,
  IndexingBenchmarkService,
  StoreService,
  PoiService,
  NodeConfig,
  ConnectionPoolService,
  StoreCacheService,
  ConnectionPoolStateManager,
  IProjectUpgradeService,
  PoiSyncService,
  InMemoryCacheService,
  SandboxService,
  MonitorService,
} from '@subql/node-core';
import { SubqueryProject } from '../configure/SubqueryProject';
import { ApiService } from './api.service';
import {
  BlockDispatcherService,
  WorkerBlockDispatcherService,
} from './blockDispatcher';
import { CardanoDictionaryService } from './dictionary/cardanoDictionary.service';
import { DsProcessorService } from './ds-processor.service';
import { DynamicDsService } from './dynamic-ds.service';
import { FetchService } from './fetch.service';
import { IndexerManager } from './indexer.manager';
import { ProjectService } from './project.service';
import { RuntimeService } from './runtime/runtimeService';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';
import { RedisCachingModule } from '../caching/redis-caching.module';
import { CustomSandboxService } from './customSandbox.service';
import { CardanoClientConnection } from './cardano/cardanoClient.connection';

@Module({
  imports: [RedisCachingModule],
  providers: [
    InMemoryCacheService,
    RedisCachingModule,
    StoreService,
    StoreCacheService,
    ApiService,
    IndexerManager,
    ConnectionPoolStateManager,
    {
      provide: 'IBlockDispatcher',
      useFactory: (
        nodeConfig: NodeConfig,
        eventEmitter: EventEmitter2,
        projectService: ProjectService,
        projectUpgradeService: IProjectUpgradeService,
        apiService: ApiService,
        indexerManager: IndexerManager,
        cacheService: InMemoryCacheService,
        storeService: StoreService,
        storeCacheService: StoreCacheService,
        poiSyncService: PoiSyncService,
        project: SubqueryProject,
        dynamicDsService: DynamicDsService,
        unfinalizedBlocks: UnfinalizedBlocksService,
        connectionPoolState: ConnectionPoolStateManager<CardanoClientConnection>,
        monitorService?: MonitorService,
      ) =>
        nodeConfig.workers
          ? new WorkerBlockDispatcherService(
              nodeConfig,
              eventEmitter,
              projectService,
              projectUpgradeService,
              cacheService,
              storeService,
              storeCacheService,
              poiSyncService,
              project,
              dynamicDsService,
              unfinalizedBlocks,
              connectionPoolState,
              monitorService,
            )
          : new BlockDispatcherService(
              apiService,
              nodeConfig,
              indexerManager,
              eventEmitter,
              projectService,
              projectUpgradeService,
              storeService,
              storeCacheService,
              poiSyncService,
              project,
            ),
      inject: [
        NodeConfig,
        EventEmitter2,
        'IProjectService',
        'IProjectUpgradeService',
        ApiService,
        IndexerManager,
        InMemoryCacheService,
        StoreService,
        StoreCacheService,
        PoiSyncService,
        'ISubqueryProject',
        DynamicDsService,
        UnfinalizedBlocksService,
        ConnectionPoolStateManager,
        MonitorService,
      ],
    },
    FetchService,
    ConnectionPoolService,
    IndexingBenchmarkService,
    PoiBenchmarkService,
    CardanoDictionaryService,
    CustomSandboxService,
    DsProcessorService,
    DynamicDsService,
    PoiService,
    PoiSyncService,
    {
      useClass: ProjectService,
      provide: 'IProjectService',
    },
    MonitorService,
    UnfinalizedBlocksService,
    RuntimeService,
  ],
  exports: [StoreService, StoreCacheService, MonitorService, PoiService],
})
export class FetchModule {}
