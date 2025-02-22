// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { NestFactory } from '@nestjs/core';
import { notifyUpdates } from '@subql/common';
import {
  exitWithError,
  getLogger,
  getValidPort,
  NestLogger,
} from '@subql/node-core';
import { AppModule } from './app.module';
import { ApiService } from './indexer/api.service';
import { FetchService } from './indexer/fetch.service';
import { ProjectService } from './indexer/project.service';
import { yargsOptions } from './yargs';

const pjson = require('../package.json');

const { argv } = yargsOptions;

const logger = getLogger('subql-node');

notifyUpdates(pjson, logger);

export async function bootstrap(): Promise<void> {
  const port = await getValidPort(argv.port);

  try {
    const app = await NestFactory.create(AppModule, {
      logger: new NestLogger(!!argv.debug),
    });
    await app.init();

    const projectService: ProjectService = app.get('IProjectService');
    const fetchService = app.get(FetchService);
    const apiService = app.get(ApiService);

    // Initialise async services, we do this here rather than in factories, so we can capture one off events
    /**
     * Load config endpoint, datasources, function fetchBlockBatches(Handler for Cardano)
     * 1. Custom Cardano Connection
     */
    await apiService.init();
    /**
     * Initialise project
     * 1. Setup schema stuff
     * 2. Init Worker
     */
    await projectService.init();
    /**
     * Fetch Block Data By Height
     * 1. Handler fetch block data
     */

    const startPoint = projectService.getStartChainPointFromDataSources();
    fetchService.runWorkerFetchChainPoint(startPoint);
    await fetchService.init(projectService.startHeight + 1);

    app.enableShutdownHooks();

    await app.listen(port);

    logger.info(`Node started on port: ${port}`);
  } catch (e) {
    exitWithError(new Error(`Node failed to start`, { cause: e }), logger);
  }
}
