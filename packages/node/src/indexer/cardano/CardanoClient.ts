import { Header } from '@subql/node-core';
import { MiniProtocolClient } from './miniProtocolClient';
import { toHex } from '../utils/hex';
import {
  BlockFetchBlock,
  BlockFetchClient,
  BlockFetchNoBlocks,
  ChainSyncClient,
  IChainPoint,
  Multiplexer,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import { Block } from '@dcspark/cardano-multiplatform-lib-nodejs';
import { MultiEraBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { Socket, connect } from 'net';

export class CardanoClient {
  public rpc: any;
  constructor(private miniClient: MiniProtocolClient) {
    this.rpc = {
      getHeader() {
        // TODO: implement
        return null;
      },
      getFinalizedHead() {
        // TODO: implement
        return null;
      },
    };
  }

  /**
   *
   * @returns Header
   */
  async getHeader(): Promise<Header> {
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

    return {
      blockHash: Buffer.from(chainTip.point.blockHeader?.hash || []).toString(
        'hex',
      ),
      blockHeight: Number(chainTip.blockNo),
      parentHash: parentHashHeader,
    };
  }
  getFinalizedHead(): Promise<Header> {
    return this.getHeader();
  }

  async getBlocksByRangePoint(
    fromChainPoint: IChainPoint,
    toChainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock[]> {
    // Get latest tip -> point
    const blockFetchClient = await this.miniClient.connectBlockFetchClient();
    const result = await blockFetchClient.requestRange(
      fromChainPoint,
      toChainPoint,
    );

    blockFetchClient.removeAllListeners();
    blockFetchClient.mplexer.close();
    this.disconnect();
    return result;
  }

  async getBlockByPoint(
    chainPoint: IChainPoint,
  ): Promise<BlockFetchNoBlocks | BlockFetchBlock> {
    const blockFetchClient = await this.miniClient.connectBlockFetchClient();
    const block = await blockFetchClient.request(chainPoint);
    this.disconnect();
    return block;
  }

  disconnect(): void {
    // nothing to be done
    this.miniClient.disconnect();
  }

  getBlockRegistry() {}
}
