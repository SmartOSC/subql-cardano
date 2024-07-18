// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Injectable } from '@nestjs/common';
import {
  BaseUnfinalizedBlocksService,
  Header,
  mainThreadOnly,
  NodeConfig,
  StoreCacheService,
} from '@subql/node-core';
import { substrateHeaderToHeader } from '../utils/substrate';
import { ApiService } from './api.service';
import { BlockContent, LightBlockContent } from './types';
import { cardanoBlockToHeader } from '../utils/cardano';

@Injectable()
export class UnfinalizedBlocksService extends BaseUnfinalizedBlocksService<
  BlockContent | LightBlockContent
> {
  constructor(
    private readonly apiService: ApiService,
    nodeConfig: NodeConfig,
    storeCache: StoreCacheService,
  ) {
    super(nodeConfig, storeCache);
  }

  // Get latest height on cardano
  @mainThreadOnly()
  protected async getFinalizedHead(): Promise<Header> {
    return this.apiService.api.getHeader();
  }

  // TODO: add cache here
  @mainThreadOnly()
  protected async getHeaderForHash(hash: string): Promise<Header> {
    return substrateHeaderToHeader(
      await this.apiService.api.rpc.getHeader(hash),
    );
  }

  @mainThreadOnly()
  protected async getHeaderForHeight(height: number): Promise<Header> {
    return Promise.resolve(cardanoBlockToHeader(height));
  }
}
