// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {
  IBlock,
  ApiConnectionError,
  ApiErrorType,
  IApiConnectionSpecific,
  NetworkMetadataPayload,
  exitWithError,
} from '@subql/node-core';
import { getLogger } from '@subql/node-core';
import { BlockContent } from '../types';
import { MiniProtocolClient } from './miniProtocolClient';
import * as CardanoUtil from '../../utils/cardano';
import { CardanoClient } from './CardanoClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = getLogger('cosmos-client-connection');

export type FetchFunc = typeof CardanoUtil.fetchBlocksBatches;
// We use a function to get the fetch function because it can change depending on the skipTransactions feature
export type GetFetchFunc = () => FetchFunc;

export class CardanoSafeClient extends CardanoClient {}

export class CardanoClientConnection
  implements
    IApiConnectionSpecific<
      CardanoClient,
      CardanoSafeClient,
      IBlock<BlockContent>[]
    >
{
  readonly networkMeta: NetworkMetadataPayload;
  private miniClient!: MiniProtocolClient;

  private constructor(
    public unsafeApi: CardanoClient,
    private fetchBlocksBatches: FetchFunc,
  ) {
    this.networkMeta = {
      chain: 'sidechain',
      specName: '',
      genesisHash: '',
    };
  }

  static async create(
    endpoint: string,
    fetchBlocksBatches: FetchFunc,
  ): Promise<CardanoClientConnection> {
    const miniClient = new MiniProtocolClient();

    const api = new CardanoClient(miniClient);
    const connection = new CardanoClientConnection(api, fetchBlocksBatches);

    connection.setMiniClient(miniClient);

    logger.info(`connected to ${endpoint}`);

    return connection;
  }

  private setMiniClient(tmClient: MiniProtocolClient): void {
    this.miniClient = tmClient;
  }

  safeApi(height: number): CardanoSafeClient {
    return new CardanoSafeClient(this.miniClient);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async apiConnect(): Promise<void> {
    this.unsafeApi = new CardanoClient(this.miniClient);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async apiDisconnect(): Promise<void> {
    this.unsafeApi.disconnect();
  }

  async fetchBlocks(heights: number[]): Promise<IBlock<BlockContent>[]> {
    const blocks = await this.fetchBlocksBatches(this.unsafeApi, heights);
    return blocks;
  }

  handleError = CardanoClientConnection.handleError;

  static handleError(e: Error): ApiConnectionError {
    let formatted_error: ApiConnectionError;
    if (e.message.startsWith(`No response received from RPC endpoint in`)) {
      formatted_error = CardanoClientConnection.handleTimeoutError(e);
    } else if (e.message.startsWith(`disconnected from `)) {
      formatted_error = CardanoClientConnection.handleDisconnectionError(e);
    } else if (e.message.startsWith(`Request failed with status code 429`)) {
      formatted_error = CardanoClientConnection.handleRateLimitError(e);
    } else if (e.message.includes(`Exceeded max limit of`)) {
      formatted_error = CardanoClientConnection.handleLargeResponseError(e);
    } else {
      formatted_error = new ApiConnectionError(
        e.name,
        e.message,
        ApiErrorType.Default,
      );
    }
    return formatted_error;
  }

  static handleRateLimitError(e: Error): ApiConnectionError {
    return new ApiConnectionError(
      'RateLimit',
      e.message,
      ApiErrorType.RateLimit,
    );
  }

  static handleTimeoutError(e: Error): ApiConnectionError {
    return new ApiConnectionError(
      'TimeoutError',
      e.message,
      ApiErrorType.Timeout,
    );
  }

  static handleDisconnectionError(e: Error): ApiConnectionError {
    return new ApiConnectionError(
      'ConnectionError',
      e.message,
      ApiErrorType.Connection,
    );
  }

  static handleLargeResponseError(e: Error): ApiConnectionError {
    const newMessage = `Oversized RPC node response. This issue is related to the network's RPC nodes configuration, not your application. You may report it to the network's maintainers or try a different RPC node.\n\n${e.message}`;

    return new ApiConnectionError(
      'RpcInternalError',
      newMessage,
      ApiErrorType.Default,
    );
  }
}
