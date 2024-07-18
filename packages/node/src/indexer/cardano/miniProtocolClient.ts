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

export class MiniProtocolClient {
  public blockFetchClient!: BlockFetchClient;
  public chainSyncClient!: ChainSyncClient;
  public socket!: Socket;

  constructor() {
    this.initialize();
  }

  async initialize() {
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
    this.blockFetchClient = client;
    client.on('error', (err) => {
      throw err;
    });
    return client;
  }

  async connectChainSyncClient(): Promise<ChainSyncClient> {
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
    const client: ChainSyncClient = new ChainSyncClient(mplexer);
    this.chainSyncClient = client;
    client.on('error', (err) => {
      throw err;
    });
    return client;
  }

  disconnect(): void {
    // nothing to be done
    this.blockFetchClient.removeAllListeners(); // This is not in the original code, but it is necessary to avoid memory leaks
    this.blockFetchClient.mplexer.close({ closeSocket: true });

    this.chainSyncClient.removeAllListeners();
    this.chainSyncClient.mplexer.close({ closeSocket: true });
    this.socket.destroy();
  }
}
