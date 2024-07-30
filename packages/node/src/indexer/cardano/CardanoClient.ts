import { Header } from '@subql/node-core';
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

export class CardanoClient {
  constructor(private miniClient: MiniProtocolClient) {}

  /**
   *
   * @returns Header
   */
  async getHeader(): Promise<Header> {
    try {
      // Get latest tip -> point
      const chainSyncClient = await this.miniClient.connectChainSyncClient();
      const { tip: chainTip } = await chainSyncClient.requestNext();

      // Get latest block header
      const blockFetch = await this.miniClient.connectBlockFetchClient();
      let parentHashHeader: string | undefined;
      const blockFetched = await blockFetch.request(chainTip.point);
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

      //await this.disconnect();
      return {
        blockHash: Buffer.from(chainTip.point.blockHeader?.hash || []).toString(
          'hex',
        ),
        blockHeight: Number(chainTip.blockNo),
        parentHash: parentHashHeader,
      };
    } catch (error) {
      console.log('[CardanoClient][GetHeader] ERR: ', error);
    }
    return this.getHeader();
  }
  getFinalizedHead(): Promise<Header> {
    return this.getHeader();
  }

  async getBlocksByRangePoint(
    fromChainPoint: IChainPoint,
    toChainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock[]> {
    try {
      // Get latest tip -> point
      const blockFetchClient = await this.miniClient.connectBlockFetchClient();
      const result = await blockFetchClient.requestRange(
        fromChainPoint,
        toChainPoint,
      );
      //await this.disconnect();
      return result;
    } catch (error) {
      console.log('[CardanoClient][getBlocksByRangePoint] ERR: ', error);
    }
    return this.getBlocksByRangePoint(fromChainPoint, toChainPoint);
  }

  async getBlockByPoint(
    chainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock> {
    try {
      const blockFetchClient = await this.miniClient.connectBlockFetchClient();
      const block = await blockFetchClient.request(chainPoint);
      //await this.disconnect();
      return block;
    } catch (error) {
      console.log('[CardanoClient][getBlockByPoint] ERR: ', error);
    }
    return this.getBlockByPoint(chainPoint);
  }

  async requestNextFromStartPoint(point: IChainPoint): Promise<IChainTip> {
    try {
      const chainSyncClient = await this.miniClient.connectChainSyncClient();
      const intersect = await chainSyncClient.findIntersect([point]);
      const rollBackwards = await chainSyncClient.requestNext();
      const rollForwards = await chainSyncClient.requestNext();
      //await this.disconnect();
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

      throw new Error('[requestNextFromStartPoint] not found point');
    } catch (error) {
      console.log(point);

      console.error('[NextFromStartPoint] ', error);
    }
    return this.requestNextFromStartPoint(point);
  }
  async findIntersect(
    point: IChainPoint,
  ): Promise<ChainSyncIntersectFound | ChainSyncIntersectNotFound> {
    const chainSyncClient = await this.miniClient.connectChainSyncClient();
    const currentData = await chainSyncClient.findIntersect([point]);
    //await this.disconnect();
    return currentData;
  }

  async disconnect(): Promise<void> {
    // nothing to be done
    await this.miniClient.disconnect();
  }

  getBlockRegistry() {}
}
