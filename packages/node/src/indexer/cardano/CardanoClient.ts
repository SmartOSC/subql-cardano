import { Header, getLogger } from '@subql/node-core';
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

const logger = getLogger('CardanoClient');
export class CardanoClient {
  constructor(private miniClient: MiniProtocolClient) {}

  /**
   *
   * @returns Header
   */
  async getHeader(): Promise<Header> {
    logger.info('Get Header Starting ...');
    try {
      // Get latest tip -> point
      const { chainSyncClient, socket: chainSyncSocket } =
        await this.miniClient.connectChainSyncClient();
      const { tip: chainTip } = await chainSyncClient.requestNext();
      this.disconnect(chainSyncClient, chainSyncSocket);

      // Get latest block header
      const { blockFetchClient, socket: blockFetchSocket } =
        await this.miniClient.connectBlockFetchClient();
      let parentHashHeader: string | undefined;
      const blockFetched = await blockFetchClient.request(chainTip.point);
      this.disconnect(blockFetchClient, blockFetchSocket);

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
      logger.info('Get Header Successful');
      return {
        blockHash: Buffer.from(chainTip.point.blockHeader?.hash || []).toString(
          'hex',
        ),
        blockHeight: Number(chainTip.blockNo),
        parentHash: parentHashHeader,
      };
    } catch (error) {
      logger.info('Get Header ERR: ', error);
    }
    logger.info('Get Header Retry');
    return this.getHeader();
  }
  getFinalizedHead(): Promise<Header> {
    return this.getHeader();
  }

  async getBlocksByRangePoint(
    fromChainPoint: IChainPoint,
    toChainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock[]> {
    logger.info('Get Blocks By Range Starting ...');
    try {
      // Get latest tip -> point
      const { blockFetchClient, socket } =
        await this.miniClient.connectBlockFetchClient();
      const result = await blockFetchClient.requestRange(
        fromChainPoint,
        toChainPoint,
      );
      this.disconnect(blockFetchClient, socket);
      return result;
    } catch (error) {
      logger.error('Get Blocks By Range ERR: ', error);
    }
    logger.info('Get Blocks By Range Retry');
    return this.getBlocksByRangePoint(fromChainPoint, toChainPoint);
  }

  async getBlockByPoint(
    chainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock> {
    logger.info('Get Blocks By Point Starting ...');
    try {
      const { blockFetchClient, socket } =
        await this.miniClient.connectBlockFetchClient();
      const block = await blockFetchClient.request(chainPoint);
      this.disconnect(blockFetchClient, socket);
      return block;
    } catch (error) {
      logger.error('Get Blocks By Point ERR: ', error);
    }
    logger.info('Get Blocks By Point Starting ...');
    return this.getBlockByPoint(chainPoint);
  }

  async requestNextFromStartPoint(point: IChainPoint): Promise<IChainTip> {
    logger.info('Request Next From Start Point Starting ...');
    try {
      const { chainSyncClient, socket } =
        await this.miniClient.connectChainSyncClient();
      const intersect = await chainSyncClient.findIntersect([point]);
      const rollBackwards = await chainSyncClient.requestNext();
      const rollForwards = await chainSyncClient.requestNext();
      this.disconnect(chainSyncClient, socket);

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
    }
    throw new Error('Request Next From Start Point failed: not found point');
  }

  async requestNext(): Promise<IChainTip> {
    const { chainSyncClient, socket: chainSyncSocket } =
      await this.miniClient.connectChainSyncClient();
    const { tip: chainTip } = await chainSyncClient.requestNext();
    this.disconnect(chainSyncClient, chainSyncSocket);

    return {
      point: {
        blockHeader: {
          hash: chainTip.point.blockHeader?.hash ?? new Uint8Array(),
          slotNumber: chainTip.point.blockHeader?.slotNumber ?? 0,
        },
      },
      blockNo: chainTip.blockNo,
    };
  }

  async findIntersect(
    point: IChainPoint,
  ): Promise<ChainSyncIntersectFound | ChainSyncIntersectNotFound> {
    const { chainSyncClient, socket } =
      await this.miniClient.connectChainSyncClient();
    const currentData = await chainSyncClient.findIntersect([point]);
    this.disconnect(chainSyncClient, socket);
    return currentData;
  }

  disconnect(client: BlockFetchClient | ChainSyncClient, socket: Socket): void {
    // nothing to be done
    this.miniClient.disconnect(client, socket);
  }

  getBlockRegistry() {}
  apiDisconnect() {
    // this.miniClient.disconnect(
    //   this.miniClient.blockFetchClient,
    //   this.miniClient.socket,
    // );
    // this.miniClient.disconnect(
    //   this.miniClient.chainSyncClient,
    //   this.miniClient.socket,
    // );
  }
}
