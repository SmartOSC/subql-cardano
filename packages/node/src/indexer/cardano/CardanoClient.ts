import { Header, delay, getLogger } from '@subql/node-core';
import { MiniProtocolClient } from './miniProtocolClient';
import { fromHex, toHex } from '../utils/hex';
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
import { Block } from '@dcspark/cardano-multiplatform-lib-nodejs';
import {
  Cbor,
  CborArray,
  CborBytes,
  CborTag,
  CborUInt,
} from '@harmoniclabs/cbor';
import { createHash32 } from '../utils/utils';
import { Socket } from 'net';
import { uniqueId } from 'lodash';
import { redis } from '../../utils/cache';

const logger = getLogger('CardanoClient');
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
  getFinalizedHead(): Promise<Header> {
    return this.getHeader();
  }

  async getBlocksByRangePoint(
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

  async getBlockByPoint(
    chainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock> {
    const { blockFetchClient, socket } =
      await this.miniClient.connectBlockFetchClient();
    try {
      const block = await blockFetchClient.request(chainPoint);
      return block;
    } catch (error) {
      logger.error('Get Blocks By Point ERR: ', error);
    } finally {
      this.disconnect(blockFetchClient, socket);
    }
    throw new Error('Get Blocks By Point Failed');
  }

  async requestNextFromStartPoint(point: IChainPoint): Promise<IChainTip> {
    const { chainSyncClient, socket } =
      await this.miniClient.connectChainSyncClient();
    try {
      const intersect = await chainSyncClient.findIntersect([point]);
      const rollBackwards = await chainSyncClient.requestNext();
      const rollForwards = await chainSyncClient.requestNext();

      if (rollForwards instanceof ChainSyncRollForward) {
        const extractChainPoint = (next: ChainSyncRollForward): IChainTip => {
          const nextData = next.data as CborArray;
          const nextHeader = nextData.array[1] as CborTag;
          let nextHeaderBytes = (nextHeader.data as CborBytes).bytes;
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
        };

        return extractChainPoint(rollForwards);
      }
    } catch (error) {
      logger.error('Request Next From Start Point ERR: ', error);
    } finally {
      this.disconnect(chainSyncClient, socket);
    }
    throw new Error('Request Next From Start Point failed: not found point');
  }

  async requestNext(): Promise<IChainTip> {
    const { chainSyncClient, socket: chainSyncSocket } =
      await this.miniClient.connectChainSyncClient();
    try {
      const { tip: chainTip } = await chainSyncClient.requestNext();

      return {
        point: {
          blockHeader: {
            hash: chainTip.point.blockHeader?.hash ?? new Uint8Array(),
            slotNumber: chainTip.point.blockHeader?.slotNumber ?? 0,
          },
        },
        blockNo: chainTip.blockNo,
      };
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
