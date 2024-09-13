// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import { Inject, Injectable } from '@nestjs/common';
import { RegisteredTypes } from '@polkadot/types/types';
import { validateSemver } from '@subql/common';
import {
  parseCardanoProjectManifest,
  ProjectManifestV1_0_0Impl,
  CardanoBlockFilter,
  isRuntimeDs,
  CardanoHandlerKind,
  isCustomDs,
} from '@subql/common-cardano';
import {
  insertBlockFiltersCronSchedules,
  loadProjectTemplates,
  updateDataSourcesV1_0_0,
  ISubqueryProject,
  CronFilter,
} from '@subql/node-core';
import {
  CardanoDatasource,
  RuntimeDatasourceTemplate,
  CustomDatasourceTemplate,
  CardanoNetworkConfig,
} from '@subql/types';
import { ParentProject, Reader, RunnerSpecs } from '@subql/types-core';
import { buildSchemaFromString } from '@subql/utils';
import { GraphQLSchema } from 'graphql';
import { getChainTypes } from '../utils/project';
import { redis } from '../utils/cache';

const { version: packageVersion } = require('../../package.json');

export type CardanoProjectDs = CardanoDatasource;
export type SubqlProjectDsTemplate =
  | RuntimeDatasourceTemplate
  | CustomDatasourceTemplate;

export type SubqlProjectBlockFilter = CardanoBlockFilter & CronFilter;

const NOT_SUPPORT = (name: string) => {
  throw new Error(`Manifest specVersion ${name} is not supported`);
};

@Injectable()
export class SubqueryProject implements ISubqueryProject {
  #dataSources: CardanoProjectDs[];

  constructor(
    readonly id: string,
    readonly root: string,
    readonly network: CardanoNetworkConfig,
    dataSources: CardanoProjectDs[],
    readonly schema: GraphQLSchema,
    readonly templates: SubqlProjectDsTemplate[],
    readonly chainTypes?: RegisteredTypes,
    readonly runner?: RunnerSpecs,
    readonly parent?: ParentProject,
  ) {
    this.#dataSources = dataSources;
  }

  get dataSources(): CardanoProjectDs[] {
    return this.#dataSources;
  }

  async applyCronTimestamps(
    getTimestamp: (height: number) => Promise<Date>,
  ): Promise<void> {
    this.#dataSources = await insertBlockFiltersCronSchedules(
      this.dataSources,
      getTimestamp,
      isRuntimeDs,
      CardanoHandlerKind.Block,
    );
  }

  static async create(
    path: string,
    rawManifest: unknown,
    reader: Reader,
    root: string, // If project local then directory otherwise temp directory
    networkOverrides?: Partial<CardanoNetworkConfig>,
  ): Promise<SubqueryProject> {
    // rawManifest and reader can be reused here.
    // It has been pre-fetched and used for rebase manifest runner options with args
    // in order to generate correct configs.

    // But we still need reader here, because path can be remote or local
    // and the `loadProjectManifest(projectPath)` only support local mode
    assert(
      rawManifest !== undefined,
      new Error(`Get manifest from project path ${path} failed`),
    );

    const manifest = parseCardanoProjectManifest(rawManifest);

    if (!manifest.isV1_0_0) {
      NOT_SUPPORT('<1.0.0');
    }

    return loadProjectFromManifestBase(
      manifest.asV1_0_0,
      reader,
      path,
      root,
      networkOverrides,
    );
  }
}

function processChainId(network: any): CardanoNetworkConfig {
  if (network.chainId && network.genesisHash) {
    throw new Error('Please only provide one of chainId and genesisHash');
  } else if (network.genesisHash && !network.chainId) {
    network.chainId = network.genesisHash;
  }
  delete network.genesisHash;
  return network;
}

type SUPPORT_MANIFEST = ProjectManifestV1_0_0Impl;

async function loadProjectFromManifestBase(
  projectManifest: SUPPORT_MANIFEST,
  reader: Reader,
  path: string,
  root: string,
  networkOverrides?: Partial<CardanoNetworkConfig>,
): Promise<SubqueryProject> {
  if (typeof projectManifest.network.endpoint === 'string') {
    projectManifest.network.endpoint = [projectManifest.network.endpoint];
  }

  const network = processChainId({
    ...projectManifest.network,
    ...networkOverrides,
  });

  await redis.set('network', JSON.stringify(network));

  assert(
    network.endpoint,
    new Error(
      `Network endpoint must be provided for network. chainId="${network.chainId}"`,
    ),
  );

  const schemaString: string = await reader.getFile(
    projectManifest.schema.file,
  );
  assert(schemaString, 'Schema file is empty');
  const schema = buildSchemaFromString(schemaString);

  const chainTypes = projectManifest.network.chaintypes
    ? await getChainTypes(reader, root, projectManifest.network.chaintypes.file)
    : undefined;

  const dataSources = await updateDataSourcesV1_0_0(
    projectManifest.dataSources,
    reader,
    root,
    isCustomDs,
  );

  const templates = await loadProjectTemplates(
    projectManifest.templates,
    root,
    reader,
    isCustomDs,
  );
  const runner = projectManifest.runner;
  assert(
    validateSemver(packageVersion, runner.node.version),
    new Error(
      `Runner require node version ${runner.node.version}, current node ${packageVersion}`,
    ),
  );

  return new SubqueryProject(
    reader.root ? reader.root : path, //TODO, need to method to get project_id
    root,
    network,
    dataSources,
    schema,
    templates,
    chainTypes,
    runner,
    projectManifest.parent,
  );
}
