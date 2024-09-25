// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0
import { connect, createConnection, Socket } from 'net';
import {
  BlockFetchClient,
  ChainSyncClient,
  MiniProtocol,
  Multiplexer,
  n2nHandshakeMessageFromCbor,
  N2NHandshakeVersion,
  N2NMessageAcceptVersion,
  N2NMessageProposeVersion,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import { redis } from '../../utils/cache';
import { getLogger } from '@subql/node-core';

const logger = getLogger('MiniProtocolClient');
export class MiniProtocolClient {
  private blockFetchClient!: BlockFetchClient;
  private chainSyncClient!: ChainSyncClient;
  private socket!: Socket;

  constructor(
    private readonly endpoint: string,
    private readonly networkMagic: number,
  ) {}

  async performHandshake(mplexer: Multiplexer, networkMagic: number) {
    return new Promise<void>((resolve, reject) => {
      mplexer.on(MiniProtocol.Handshake, (chunk) => {
        const msg = n2nHandshakeMessageFromCbor(chunk);

        if (msg instanceof N2NMessageAcceptVersion) {
          mplexer.clearListeners(MiniProtocol.Handshake);
          resolve();
        } else {
          logger.error(`connection refused ${msg}`);
          throw new Error('TODO: handle rejection');
        }
      });

      mplexer.send(
        new N2NMessageProposeVersion({
          versionTable: [
            {
              version: N2NHandshakeVersion.v10,
              data: {
                networkMagic,
                initiatorAndResponderDiffusionMode: false,
                peerSharing: 0,
                query: false,
              },
            },
          ],
        })
          .toCbor()
          .toBuffer(),
        {
          hasAgency: true,
          protocol: MiniProtocol.Handshake,
        },
      );
    });
  }

  async connectBlockFetchClient(): Promise<{
    blockFetchClient: BlockFetchClient;
    socket: Socket;
  }> {
    await redis.incr('num_of_socket');
    try {
      // connection harmoniclabs
      const url = new URL(this.endpoint);
      const socket = connect({
        host: url.hostname,
        port: Number(url.port || 3001),
        keepAlive: false,
        keepAliveInitialDelay: 0,
        timeout: 10000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5000,
      });
      const mplexer: Multiplexer = new Multiplexer({
        protocolType: 'node-to-node',
        connect: () => {
          if (socket.destroyed) {
            socket.destroy();
            mplexer.close({
              closeSocket: true,
            });
          }
          return socket;
        },
      });
      await this.performHandshake(mplexer, this.networkMagic);
      socket.on('close', () => {
        mplexer.close({
          closeSocket: true,
        });
      });
      socket.on('error', () => {
        socket.destroy();
        mplexer.close({
          closeSocket: true,
        });
      });

      // create client harmoniclabs
      const blockFetchClient: BlockFetchClient = new BlockFetchClient(mplexer);
      blockFetchClient.on('error', (err) => {
        throw err;
      });
      return { blockFetchClient, socket };
    } catch (error) {
      logger.error(`[MiniProtocolClient][connectBlockFetchClient] ERR:`, error);
    }

    return this.connectBlockFetchClient();
  }

  async connectChainSyncClient(): Promise<{
    chainSyncClient: ChainSyncClient;
    socket: Socket;
  }> {
    await redis.incr('num_of_socket');
    try {
      const url = new URL(this.endpoint);
      const socket = connect({
        host: url.hostname,
        port: Number(url.port || 3001),
        keepAlive: false,
        keepAliveInitialDelay: 0,
        timeout: 10000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5000,
      });
      const mplexer: Multiplexer = new Multiplexer({
        protocolType: 'node-to-node',
        connect: () => {
          if (socket.destroyed) {
            socket.destroy();
            mplexer.close({
              closeSocket: true,
            });
          }
          return socket;
        },
      });
      await this.performHandshake(mplexer, this.networkMagic);
      socket.on('close', () => {
        mplexer.close({
          closeSocket: true,
        });
      });
      socket.on('error', (err) => {
        socket.destroy();
        mplexer.close({
          closeSocket: true,
        });
      });

      // create client harmoniclabs
      const chainSyncClient: ChainSyncClient = new ChainSyncClient(mplexer);
      chainSyncClient.on('error', (err) => {
        throw err;
      });

      return { chainSyncClient, socket };
    } catch (error) {
      logger.error('[MiniProtocolClient][connectChainSyncClient] ERR: ', error);
    }

    return this.connectChainSyncClient();
  }

  disconnect(client: BlockFetchClient | ChainSyncClient, socket: Socket): void {
    redis.decr('num_of_socket');
    client.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks
    client.mplexer.close({ closeSocket: true });
    socket.destroy();
  }
}
