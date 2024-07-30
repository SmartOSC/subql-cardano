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

export class MiniProtocolClient {
  public blockFetchClient!: BlockFetchClient;
  public chainSyncClient!: ChainSyncClient;
  public socket!: Socket;

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      // connection harmoniclabs
      const socket = connect({
        host: '192.168.10.136',
        port: 3001,
        keepAlive: false,
        keepAliveInitialDelay: 0,
        timeout: 10000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5000,
      });
      this.socket = socket;
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
      await this.performHandshake(mplexer, 42);
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
      const client: BlockFetchClient = new BlockFetchClient(mplexer);
      const chainSyncClient: ChainSyncClient = new ChainSyncClient(mplexer);

      this.chainSyncClient = chainSyncClient;
      this.blockFetchClient = client;

      client.on('error', (err) => {
        throw err;
      });

      setTimeout(() => {
        socket.destroy();
      }, 10000);
    } catch (err) {
      console.error('[MiniProtocolConnectionERR]', err);
    }
    this.initialize();
  }

  async performHandshake(mplexer: Multiplexer, networkMagic: number) {
    return new Promise<void>((resolve, reject) => {
      mplexer.on(MiniProtocol.Handshake, (chunk) => {
        const msg = n2nHandshakeMessageFromCbor(chunk);

        if (msg instanceof N2NMessageAcceptVersion) {
          mplexer.clearListeners(MiniProtocol.Handshake);
          console.log(
            'connected to node',
            (mplexer.socket.unwrap() as Socket).remoteAddress,
          );
          resolve();
        } else {
          console.error('connection refused', msg);
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

  async connectBlockFetchClient(): Promise<BlockFetchClient> {
    try {
      await redis.incr('number_of_socket');
      // connection harmoniclabs
      const socket = connect({
        host: '192.168.10.136',
        port: 3001,
        keepAlive: false,
        keepAliveInitialDelay: 0,
        timeout: 10000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5000,
      });
      this.socket = socket;
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
      await this.performHandshake(mplexer, 42);
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
      const client: BlockFetchClient = new BlockFetchClient(mplexer);
      if (this.blockFetchClient) {
        this.blockFetchClient.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks
        this.blockFetchClient.mplexer.close({ closeSocket: true });
      }
      this.blockFetchClient = client;
      client.on('error', (err) => {
        throw err;
      });
      setTimeout(() => {
        socket.destroy();
      }, 10000);
      return client;
    } catch (error) {
      console.error(
        '[MiniProtocolClient][connectBlockFetchClient] ERR: ',
        error,
      );
    }

    return this.connectBlockFetchClient();
  }

  async connectChainSyncClient(): Promise<ChainSyncClient> {
    try {
      await redis.incr('number_of_socket');
      const socket = connect({
        host: '192.168.10.136',
        port: 3001,
        keepAlive: false,
        keepAliveInitialDelay: 0,
        timeout: 10000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 5000,
      });
      this.socket = socket;
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
      await this.performHandshake(mplexer, 42);
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
      const client: ChainSyncClient = new ChainSyncClient(mplexer);
      if (this.chainSyncClient) {
        this.chainSyncClient.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks
        this.chainSyncClient.mplexer.close({ closeSocket: true });
      }
      this.chainSyncClient = client;
      client.on('error', (err) => {
        throw err;
      });
      setTimeout(() => {
        socket.destroy();
      }, 10000);
      return client;
    } catch (error) {
      console.error(
        '[MiniProtocolClient][connectChainSyncClient] ERR: ',
        error,
      );
    }

    return this.connectChainSyncClient();
  }

  async disconnect(): Promise<void> {
    await redis.decr('number_of_socket');

    this.blockFetchClient.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks
    this.chainSyncClient.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks

    this.chainSyncClient.mplexer.close({ closeSocket: true });
    this.blockFetchClient.mplexer.close({ closeSocket: true });

    this.socket.destroy();
  }
}
