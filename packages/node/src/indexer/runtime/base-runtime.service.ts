// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Injectable } from '@nestjs/common';
import { ApiPromise } from '@polkadot/api';
import { RuntimeVersion } from '@polkadot/types/interfaces';
import { profiler } from '@subql/node-core';
import { CardanoBlock } from '@subql/types';
import * as SubstrateUtil from '../../utils/substrate';
import { ApiService } from '../api.service';
import { SpecVersion } from '../dictionary';
import { CardanoClient } from '../cardano/CardanoClient';
import { CardanoBlockContent, LightBlockContent } from '../types';
export const SPEC_VERSION_BLOCK_GAP = 100;
type GetLatestFinalizedHeight = () => number;

@Injectable()
export abstract class BaseRuntimeService {
  parentSpecVersion?: number;
  specVersionMap: SpecVersion[] = [];
  private currentRuntimeVersion?: RuntimeVersion;
  latestFinalizedHeight?: number;

  constructor(protected apiService: ApiService) {}

  async specChanged(height: number, specVersion: number): Promise<boolean> {
    if (this.parentSpecVersion !== specVersion) {
      const parentSpecVersionCopy = this.parentSpecVersion;
      this.parentSpecVersion = specVersion;
      await this.prefetchMeta(height);
      // When runtime init parentSpecVersion is undefined, count as unchanged,
      // so it will not use fetchRuntimeVersionRange
      return parentSpecVersionCopy !== undefined;
    }
    return false;
  }

  abstract getSpecVersion(
    blockHeight: number,
  ): Promise<{ blockSpecVersion: number; syncedDictionary: boolean }>;

  init(getLatestFinalizedHeight: GetLatestFinalizedHeight): void {
    this.latestFinalizedHeight = getLatestFinalizedHeight();
  }

  get api(): CardanoClient {
    return this.apiService.unsafeApi;
  }

  getSpecFromMap(
    blockHeight: number,
    specVersions?: SpecVersion[],
  ): number | undefined {
    //return undefined block can not find inside range
    const spec = specVersions?.find(
      (spec) =>
        blockHeight >= spec.start &&
        (spec.end !== null ? blockHeight <= spec.end : true),
    );
    return spec ? Number(spec.id) : undefined;
  }

  // TODO: Cardano can remove?
  async getSpecFromApi(height: number): Promise<number> {
    // startTip: 163541
    // startBlockHash: 6e465338ce45a180998c10d06a1bb86ca038e49d06ac3ddd244e3c73af3a3acc
    // const parentBlockHash = await this.apiService.api.getBlockHashByPoint(
    //   163541,
    //   '6e465338ce45a180998c10d06a1bb86ca038e49d06ac3ddd244e3c73af3a3acc',
    // );
    // const runtimeVersion =
    //   await this.api.rpc.state.getRuntimeVersion(parentBlockHash);
    // const specVersion = runtimeVersion.specVersion.toNumber();
    return 0;
  }

  @profiler()
  async prefetchMeta(height: number): Promise<void> {
    // const blockHash = await this.api.rpc.chain.getBlockHash(height);
    // if (
    //   this.parentSpecVersion !== undefined &&
    //   this.specVersionMap &&
    //   this.specVersionMap.length !== 0
    // ) {
    //   const parentSpecVersion = this.specVersionMap.find(
    //     (spec) => Number(spec.id) === this.parentSpecVersion,
    //   );
    //   if (parentSpecVersion === undefined) {
    //     await SubstrateUtil.prefetchMetadata(this.api, blockHash);
    //   } else {
    //     for (const specVersion of this.specVersionMap) {
    //       if (
    //         (parentSpecVersion.end !== null
    //           ? specVersion.start > parentSpecVersion.end
    //           : true) &&
    //         specVersion.start <= height
    //       ) {
    //         const blockHash = await this.api.rpc.chain.getBlockHash(
    //           specVersion.start,
    //         );
    //         await SubstrateUtil.prefetchMetadata(this.api, blockHash);
    //       }
    //     }
    //   }
    // } else {
    //   await SubstrateUtil.prefetchMetadata(this.api, blockHash);
    // }
    return Promise.resolve();
  }

  async getRuntimeVersion(
    block: CardanoBlockContent | LightBlockContent,
  ): Promise<RuntimeVersion> {
    // if (
    //   !this.currentRuntimeVersion ||
    //   this.currentRuntimeVersion.specVersion.toNumber() !== block.specVersion
    // ) {
    //   this.currentRuntimeVersion = await this.api.rpc.state.getRuntimeVersion(
    //     block.block.header.parentHash,
    //   );
    // }
    // return this.currentRuntimeVersion;

    return Promise.resolve(null as unknown as RuntimeVersion);
  }
}
