// SPDX-License-Identifier: GPL-3.0

import { Socket } from 'net';
import { Block } from '@dcspark/cardano-multiplatform-lib-nodejs';
import {
  Cbor,
  CborArray,
  CborBytes,
  CborTag,
  CborUInt,
} from '@harmoniclabs/cbor';
import {
  BlockFetchBlock,
  BlockFetchClient,
  BlockFetchNoBlocks,
  ChainSyncClient,
  ChainSyncIntersectFound,
  ChainSyncIntersectNotFound,
  ChainSyncRollBackwards,
  ChainSyncRollForward,
  IChainPoint,
  IChainTip,
  Multiplexer,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import {
  Header,
  backoffRetry,
  delay,
  getLogger,
  isBackoffError,
  timeout,
} from '@subql/node-core';
import { redis } from '../../utils/cache';
import { fromHex, toHex } from '../utils/hex';
import { createHash32 } from '../utils/utils';
import { MiniProtocolClient } from './miniProtocolClient';

const logger = getLogger('CardanoClient');
const MAX_RECONNECT_ATTEMPTS = 5;
export class CardanoClient {
  constructor(private miniClient: MiniProtocolClient) {}

  /**
   *
   * @returns Header
   */
  async getHeader(): Promise<Header> {
    const latestHeaderCached = await redis.get('latestHeader');
    if (latestHeaderCached) {
      return JSON.parse(latestHeaderCached);
    }
    // Get latest tip -> point
    const { chainSyncClient, socket: chainSyncSocket } =
      await this.miniClient.connectChainSyncClient();
    // Get latest block header
    const { blockFetchClient, socket: blockFetchSocket } =
      await this.miniClient.connectBlockFetchClient();
    try {
      const { tip: chainTip } = await chainSyncClient.requestNext();

      let parentHashHeader: string | undefined;
      const blockFetched = await blockFetchClient.request(chainTip.point);

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

      const header = {
        blockHash: Buffer.from(chainTip.point.blockHeader?.hash || []).toString(
          'hex',
        ),
        blockHeight: Number(chainTip.blockNo),
        parentHash: parentHashHeader,
      };
      await redis.set('latestHeader', JSON.stringify(header), 'EX', 2);
      return header;
    } catch (error) {
      logger.info('Get Header ERR: ', error);
    } finally {
      this.disconnect(chainSyncClient, chainSyncSocket);
      this.disconnect(blockFetchClient, blockFetchSocket);
    }
    throw new Error('Get Header Failed');
  }
  async getFinalizedHead(): Promise<Header> {
    return this.getHeader();
  }

  async fetchBlocksByRangePoint(
    fromChainPoint: IChainPoint,
    toChainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock[]> {
    // Get latest tip -> point
    const { blockFetchClient, socket } =
      await this.miniClient.connectBlockFetchClient();
    try {
      const result = await blockFetchClient.requestRange(
        fromChainPoint,
        toChainPoint,
      );
      return result;
    } catch (error) {
      logger.error('Get Blocks By Range ERR: ', error);
    } finally {
      this.disconnect(blockFetchClient, socket);
    }
    throw new Error('Get Blocks By Range Point Failed');
  }

  async fetchBlockByPoint(chainPoint: IChainPoint): Promise<BlockFetchBlock> {
    const { blockFetchClient, socket } =
      await this.miniClient.connectBlockFetchClient();
    try {
      const block = await blockFetchClient.request(chainPoint);
      if (block instanceof BlockFetchBlock) return block;

      throw new Error(
        `Not found block by chain point {hash=${chainPoint.blockHeader?.hash}, blockNum=${chainPoint.blockHeader?.slotNumber}}`,
      );
    } catch (error) {
      logger.error('Get Blocks By Point ERR: ', error);
    } finally {
      this.disconnect(blockFetchClient, socket);
    }
    throw new Error('Get Blocks By Point Failed');
  }

  async requestNextPointFromStart(
    point: IChainPoint,
    batchSize: number,
  ): Promise<IChainTip[]> {
    const { chainSyncClient, socket } =
      await this.miniClient.connectChainSyncClient();
    try {
      const intersect = await chainSyncClient.findIntersect([point]);
      if (intersect instanceof ChainSyncIntersectNotFound) return [];

      const rollBackwards = await chainSyncClient.requestNext();

      const results: IChainTip[] = [];
      for (let i = 0; i < batchSize; i++) {
        const rollForwards =
          await this.fetchNextRollForwardPoint(chainSyncClient);
        if (rollForwards) {
          results.push(rollForwards);
        }
        // const rollForwards = await chainSyncClient.requestNext();
        // if (rollForwards instanceof ChainSyncRollForward) {
        //   results.push(this.extractChainPoint(rollForwards));
        // }
      }

      return results;
    } catch (error) {
      logger.error('Request Next From Start Point ERR: ', error);
    } finally {
      this.disconnect(chainSyncClient, socket);
    }
    throw new Error('Request Next From Start Point failed: not found point');
  }

  extractChainPoint(next: ChainSyncRollForward): IChainTip {
    const nextData = next.data as CborArray;
    const nextHeader = nextData.array[1] as CborTag;
    const nextHeaderBytes = (nextHeader.data as CborBytes).bytes;
    const blockHeaderCbor = Cbor.parse(nextHeaderBytes) as CborArray;
    const blockHeaderBody = blockHeaderCbor.array[0];
    const blockHash = createHash32(nextHeaderBytes);

    const blockHeaderBodyArray = (blockHeaderBody as CborArray).array;
    const [blockNoCbor, blockSlotCbor] = blockHeaderBodyArray;

    return {
      point: {
        blockHeader: {
          hash: fromHex(blockHash),
          slotNumber: (blockSlotCbor as CborUInt).num,
        },
      },
      blockNo: (blockNoCbor as CborUInt).num,
    };
  }

  async fetchNextRollForwardPoint(
    chainSyncClient: ChainSyncClient,
  ): Promise<IChainTip> {
    return this.retryFetchNextRollForwardPoint(() => {
      const promiseFn = async (): Promise<IChainTip> => {
        const rollForwards = await chainSyncClient.requestNext();
        if (rollForwards instanceof ChainSyncRollForward) {
          return this.extractChainPoint(rollForwards);
        }
        throw new Error('Fetch Next Roll Forward Point failed');
      };
      return timeout(promiseFn(), 10, `Fetch Next Roll Forward Point timeout.`);
    }, MAX_RECONNECT_ATTEMPTS);
  }

  async retryFetchNextRollForwardPoint(
    fn: () => Promise<IChainTip>,
    numAttempts = MAX_RECONNECT_ATTEMPTS,
  ): Promise<IChainTip> {
    try {
      return await backoffRetry(fn, numAttempts);
    } catch (e) {
      if (isBackoffError(e)) {
        logger.error(e.message);
        throw e.lastError;
      }
      throw e;
    }
  }

  async requestNextPoint(batchSize: number): Promise<IChainTip[]> {
    const { chainSyncClient, socket: chainSyncSocket } =
      await this.miniClient.connectChainSyncClient();
    try {
      const results: IChainTip[] = [];
      for (let i = 0; i < batchSize; i++) {
        const { tip: chainTip } = await chainSyncClient.requestNext();

        results.push({
          point: {
            blockHeader: {
              hash: chainTip.point.blockHeader?.hash ?? new Uint8Array(),
              slotNumber: chainTip.point.blockHeader?.slotNumber ?? 0,
            },
          },
          blockNo: chainTip.blockNo,
        });
      }

      return results;
    } catch (error) {
      logger.error('Request Next ERR: ', error);
    } finally {
      this.disconnect(chainSyncClient, chainSyncSocket);
    }
    throw new Error('Request Next failed');
  }

  async findIntersect(
    point: IChainPoint,
  ): Promise<ChainSyncIntersectFound | ChainSyncIntersectNotFound> {
    const { chainSyncClient, socket } =
      await this.miniClient.connectChainSyncClient();
    try {
      const currentData = await chainSyncClient.findIntersect([point]);
      return currentData;
    } catch (error) {
      logger.error('Request Find Intersect ERR: ', error);
    } finally {
      this.disconnect(chainSyncClient, socket);
    }

    throw new Error('Request Find Intersect failed');
  }

  disconnect(client: BlockFetchClient | ChainSyncClient, socket: Socket): void {
    // nothing to be done
    this.miniClient.disconnect(client, socket);
  }

  getBlockRegistry() {}
  apiDisconnect() {}
}
