// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { MultiEraBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { ApiPromise } from '@polkadot/api';
import { ApiDecoration } from '@polkadot/api/types';
import type { HexString } from '@polkadot/util/types';
import {
  BlockHeader,
  LightSubstrateEvent,
  SubstrateBlock,
  SubstrateEvent,
  SubstrateExtrinsic,
} from '@subql/types';

export interface BlockContent {
  block: SubstrateBlock;
  extrinsics: SubstrateExtrinsic[];
  events: SubstrateEvent[];
}

export interface Attribute {
  readonly key: string;
  readonly value: string;
}
export interface Event {
  readonly type: string;
  readonly attributes: readonly Attribute[];
}

export interface CardanoEvent {
  idx: number;
  event: Event;
}

export interface CardanoBlockContent {
  block: {
    multiEraBlock: MultiEraBlock;
    cborHexBlock: string;
  };
  events: SubstrateEvent[];
}

export interface LightBlockContent {
  block: BlockHeader; // A subset of SubstrateBlock
  events: LightSubstrateEvent[];
}

export type BestBlocks = Record<number, HexString>;

export type ApiAt = ApiDecoration<'promise'> & { rpc: ApiPromise['rpc'] };

export function isFullBlock(
  block: CardanoBlockContent | LightBlockContent,
): block is CardanoBlockContent {
  return (block as CardanoBlockContent) !== undefined;
}
