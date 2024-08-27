// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import {
  BaseUnfinalizedBlocksService,
  Header,
  mainThreadOnly,
  NodeConfig,
  StoreCacheService,
} from '@subql/node-core';
import { ApiService } from './api.service';
import { BlockContent, CardanoBlockContent, LightBlockContent } from './types';
import { getChainTipByHeight } from '../utils/cache';
import { Block } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { BlockFetchBlock } from '@harmoniclabs/ouroboros-miniprotocols-ts';

@Injectable()
export class UnfinalizedBlocksService extends BaseUnfinalizedBlocksService<
  CardanoBlockContent | LightBlockContent
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
    // TODO: implement
    return null as unknown as Header;
  }

  @mainThreadOnly()
  protected async getHeaderForHeight(height: number): Promise<Header> {
    // get point
    const existedStartBlockHeight = await getChainTipByHeight(height);
    if (!existedStartBlockHeight) return null as unknown as Header;
    const chainPoint = existedStartBlockHeight.point;

    const blockFetched = await this.apiService.api.getBlockByPoint(chainPoint);
    let parentHashHeader: string | undefined;
    if (blockFetched instanceof BlockFetchBlock) {
      const blockBytes = blockFetched.getBlockBytes();
      if (blockBytes !== undefined) {
        // TODO: decode block cbor
        // const block2 =
        //   MultiEraBlock.from_explicit_network_cbor_bytes(blockBytes);
        const block = Block.from_cbor_bytes(blockBytes?.slice(2));

        parentHashHeader = block.header().header_body().prev_hash()?.to_hex();
      }
    }

    return {
      blockHash: Buffer.from(chainPoint.blockHeader?.hash || []).toString(
        'hex',
      ),
      blockHeight: Number(existedStartBlockHeight.blockNo),
      parentHash: parentHashHeader,
    };
  }
}
