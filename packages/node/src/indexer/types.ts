// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { MultiEraBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import type { HexString } from '@polkadot/util/types';
import {
  BlockHeader,
  CardanoBlock,
  CardanoExtrinsic,
} from '@subql/types';

export interface BlockContent {
  block: CardanoBlock;
  extrinsics: CardanoExtrinsic[];
}

export interface Attribute {
  readonly key: string;
  readonly value: string;
}
export interface Event {
  readonly type: string;
  readonly attributes: readonly Attribute[];
}

export interface CardanoBlockContent {
  block: {
    multiEraBlock: MultiEraBlock;
    cborHexBlock: string;
  };
}

export interface LightBlockContent {
  block: BlockHeader; // A subset of SubstrateBlock
}

export type BestBlocks = Record<number, HexString>;

export type ApiAt = ApiDecoration<'promise'> & { rpc: ApiPromise['rpc'] };

export function isFullBlock(
  block: CardanoBlockContent | LightBlockContent,
): block is CardanoBlockContent {
  return (block as CardanoBlockContent) !== undefined;
}
