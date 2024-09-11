// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { CardanoDataSource } from '@subql/common-cardano';
import {
  NodeConfig,
  DictionaryV2,
  DictionaryResponse,
  getLogger,
  DictionaryV2QueryEntry,
  RawDictionaryResponseData,
  IBlock,
} from '@subql/node-core';
import { CardanoBlock, CardanoDatasource } from '@subql/types';
import { SubqueryProject } from '../../../configure/SubqueryProject';
import { CardanoDictionaryV2QueryEntry } from './types';

const MIN_FETCH_LIMIT = 200;

export function buildDictionaryV2QueryEntry(
  dataSources: CardanoDataSource[],
): CardanoDictionaryV2QueryEntry {
  const dictionaryConditions: CardanoDictionaryV2QueryEntry = {
    logs: [],
    transactions: [],
  };
  //TODO
  return dictionaryConditions;
}

export class CardanoDictionaryV2 extends DictionaryV2<
  CardanoBlock,
  CardanoDatasource,
  CardanoDictionaryV2QueryEntry
> {
  protected buildDictionaryQueryEntries(
    dataSources: CardanoDataSource[],
  ): DictionaryV2QueryEntry {
    return buildDictionaryV2QueryEntry(dataSources);
  }

  constructor(
    endpoint: string,
    nodeConfig: NodeConfig,
    project: SubqueryProject,
    chainId?: string,
  ) {
    super(endpoint, chainId ?? project.network.chainId, nodeConfig);
  }

  static async create(
    endpoint: string,
    nodeConfig: NodeConfig,
    project: SubqueryProject,
    chainId?: string,
  ): Promise<CardanoDictionaryV2> {
    const dictionary = new CardanoDictionaryV2(
      endpoint,
      nodeConfig,
      project,
      chainId,
    );
    await dictionary.init();
    return dictionary;
  }

  /**
   *
   * @param startBlock
   * @param queryEndBlock this block number will limit the max query range, increase dictionary query speed
   * @param batchSize
   * @param conditions
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getData(
    startBlock: number,
    queryEndBlock: number,
    limit = MIN_FETCH_LIMIT,
  ): Promise<DictionaryResponse<IBlock<CardanoBlock> | number> | undefined> {
    return this.getData(startBlock, queryEndBlock, limit);
  }

  // TODO, complete this once cardano support v2
  convertResponseBlocks(
    result: RawDictionaryResponseData<any>,
  ): DictionaryResponse<IBlock<CardanoBlock>> | undefined {
    return undefined;
  }
}
