// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ProviderInterface } from '@polkadot/rpc-provider/types';
import { RegisteredTypes } from '@polkadot/types/types';
import {
  ApiConnectionError,
  ApiErrorType,
  DisconnectionError,
  LargeResponseError,
  NetworkMetadataPayload,
  RateLimitError,
  TimeoutError,
  IApiConnectionSpecific,
  IBlock,
} from '@subql/node-core';
import * as CardanoUtil from '../utils/cardano';
import { ApiAt, BlockContent, CardanoBlockContent, LightBlockContent } from './types';
import { createCachedProvider } from './x-provider/cachedProvider';
import { HttpProvider } from './x-provider/http';
import { CardanoSafeClient } from './cardano/cardanoClient.connection';
import { CardanoClient } from './cardano/CardanoClient';
import { MiniProtocolClient } from './cardano/miniProtocolClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: packageVersion } = require('../../package.json');

const RETRY_DELAY = 2_500;

export type FetchFunc =
  typeof CardanoUtil.fetchBlocksBatches

// We use a function to get the fetch function because it can change depending on the skipTransactions feature
export type GetFetchFunc = () => FetchFunc;

export class ApiPromiseConnection
  implements
    IApiConnectionSpecific<
    CardanoClient,
    CardanoSafeClient,
      IBlock<CardanoBlockContent>[]
    >
{
  readonly networkMeta: NetworkMetadataPayload;

  private constructor(
    public unsafeApi: CardanoClient,
    private fetchBlocksBatches: GetFetchFunc,
  ) {
    this.networkMeta = {
      chain: "cardano",
      specName: "",
      genesisHash: "",
    };
  }

  static async create(
    endpoint: string,
    fetchBlocksBatches: GetFetchFunc,
    args: { chainTypes?: RegisteredTypes },
  ): Promise<ApiPromiseConnection> {
    let provider: ProviderInterface;
    let throwOnConnect = false;

    const headers = {
      'User-Agent': `SubQuery-Node ${packageVersion}`,
    };

    if (endpoint.startsWith('ws')) {
      provider = createCachedProvider(
        new WsProvider(endpoint, RETRY_DELAY, headers),
      );
    } else if (endpoint.startsWith('http')) {
      provider = createCachedProvider(new HttpProvider(endpoint, headers));
      throwOnConnect = true;
    } else {
      throw new Error(`Invalid endpoint: ${endpoint}`);
    }

    const apiOption = {
      provider,
      throwOnConnect,
      noInitWarn: true,
      ...args.chainTypes,
    };

    provider.disconnect()

    // TODO: Load endpoint from datasource
    const miniClient = new MiniProtocolClient(endpoint)
    const api = new CardanoClient(miniClient);
    return new ApiPromiseConnection(api, fetchBlocksBatches);
  }

  safeApi(height: number): CardanoSafeClient {
    throw new Error(`Not Implemented`);
  }

  async fetchBlocks(
    heights: number[],
    overallSpecVer?: number,
  ): Promise<IBlock<CardanoBlockContent>[]> {
    const blocks = await this.fetchBlocksBatches()(
      this.unsafeApi,
      heights,
    );
    return blocks;
  }

  async apiConnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      resolve();
      // if (this.unsafeApi.isConnected) {
      //   resolve();
      // }

      // this.unsafeApi.on('connected', () => {
      //   resolve();
      // });

      // if (!this.unsafeApi.isConnected) {
      //   this.unsafeApi.connect();
      // }
    });
  }

  async apiDisconnect(): Promise<void> {
    // await this.unsafeApi.disconnect();
  }

  handleError = ApiPromiseConnection.handleError;

  static handleError(e: Error): ApiConnectionError {
    let formatted_error: ApiConnectionError;
    if (e.message.startsWith(`No response received from RPC endpoint in`)) {
      formatted_error = new TimeoutError(e);
    } else if (e.message.startsWith(`disconnected from `)) {
      formatted_error = new DisconnectionError(e);
    } else if (e.message.startsWith(`-32029: Too Many Requests`)) {
      formatted_error = new RateLimitError(e);
    } else if (e.message.includes(`Exceeded max limit of`)) {
      formatted_error = new LargeResponseError(e);
    } else {
      formatted_error = new ApiConnectionError(
        e.name,
        e.message,
        ApiErrorType.Default,
      );
    }
    return formatted_error;
  }
}
