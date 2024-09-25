import {
  backoffRetry,
  getLogger,
  Header,
  IBlock,
  isBackoffError,
  timeout,
} from '@subql/node-core';
import { BlockContent, CardanoBlockContent } from '../indexer/types';
import { CardanoClient } from '../indexer/cardano/CardanoClient';
import { redis as redisClient, getChainTipByHeight } from './cache';
import { sortBy } from 'lodash';
import {
  BlockFetchBlock,
  BlockFetchNoBlocks,
  IChainPoint,
  IChainTip,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import { MultiEraBlock } from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { Block } from '@dcspark/cardano-multiplatform-lib-nodejs';
import { toHex } from '../indexer/utils/hex';
import {
  CardanoBlock,
  CardanoBlockFilter,
  CardanoCallFilter,
  CardanoExtrinsic,
} from '@subql/types';
const MAX_RECONNECT_ATTEMPTS = 5;

const logger = getLogger('CardanoUtil');

export async function fetchBlocksBatches(
  api: CardanoClient,
  blockArray: number[],
): Promise<IBlock<CardanoBlockContent>[]> {
  try {
    // TODO: implement issue missing point of block
    /**
     * 1. Check block is cached
     * 2. Get block content
     * 3. Handler fetch events + transaction IBC -> khoai sẽ cần handler
     */
    // const blockArrayTmp = sortBy(
    //   blockArray,
    //   function (e) {
    //     return Number(e);
    //   },
    //   ['desc'],
    // );
    // const startHeight = blockArrayTmp[0];
    // const endHeight = blockArrayTmp[blockArrayTmp.length - 1];
    // const blocks = await fetchBlocksRange(api, startHeight, endHeight);
    // if (!(blocks instanceof BlockFetchNoBlocks)) {
    //   console.log({
    //     blocks,
    //   });
    // }
    const blocks = await Promise.all(
      blockArray.map((height) => fetchBlockByHeight(api, height)),
    );
    return blocks
      .filter((block) => block instanceof BlockFetchBlock)
      .map((block) => {
        const blockBytes = (block as BlockFetchBlock).getBlockBytes();
        const blockBody =
          MultiEraBlock.from_explicit_network_cbor_bytes(blockBytes);

        // const blockBody = Block.from_cbor_bytes(blockBytes.slice(2));

        return formatBlockUtil(
          new LazyBlockContent(blockBody, toHex(blockBytes)),
        );
      });
  } catch (error) {
    console.error('ERR fetchBlocksBatches', error);
  }

  return [];
}

/*
 * Cardano has instant finalization, there is also no rpc method to get a block by hash
 * To get around this we use blockHeights as hashes
 */
export function cardanoBlockToHeader(blockHeader: MultiEraBlock): Header {
  if (blockHeader.as_conway())
    return {
      blockHeight: Number(
        blockHeader.as_conway()?.header().header_body().block_number(),
      ),
      blockHash:
        blockHeader
          .as_conway()
          ?.header()
          .header_body()
          .block_body_hash()
          .to_hex()
          .toString() ?? '',
      parentHash: blockHeader
        .as_conway()
        ?.header()
        .header_body()
        .prev_hash()
        ?.to_hex()
        .toString(),
    };
  if (blockHeader.as_alonzo())
    return {
      blockHeight: Number(
        blockHeader.as_alonzo()?.header().body().block_number(),
      ),
      blockHash:
        blockHeader
          .as_alonzo()
          ?.header()
          .body()
          .block_body_hash()
          .to_hex()
          .toString() ?? '',
      parentHash: blockHeader
        .as_alonzo()
        ?.header()
        .body()
        .prev_hash()
        ?.to_hex()
        .toString(),
    };
  if (blockHeader.as_babbage())
    return {
      blockHeight: Number(
        blockHeader.as_babbage()?.header().header_body().block_number(),
      ),
      blockHash:
        blockHeader
          .as_babbage()
          ?.header()
          .header_body()
          .block_body_hash()
          .to_hex()
          .toString() ?? '',
      parentHash: blockHeader
        .as_babbage()
        ?.header()
        .header_body()
        .prev_hash()
        ?.to_hex()
        .toString(),
    };

  throw new Error('Unsupported block type');
}

export function formatBlockUtil<B extends CardanoBlockContent>(
  block: B,
): IBlock<B> {
  return {
    block,
    getHeader: () => cardanoBlockToHeader(block.block.multiEraBlock),
  };
}

/**
 *
 * @param api
 * @param startHeight
 * @param endHeight
 */
export async function fetchBlocksRange(
  api: CardanoClient,
  startHeight: number,
  endHeight: number,
): Promise<BlockFetchNoBlocks | BlockFetchBlock[]> {
  const fromChainTip = await getChainTipByHeight(startHeight);
  const toChainTip = await getChainTipByHeight(endHeight);
  if (!fromChainTip || !toChainTip) return [];

  const result = await api.fetchBlocksByRangePoint(
    (fromChainTip as unknown as IChainTip).point,
    (toChainTip as unknown as IChainTip).point,
  );

  return result;
}

export function filterBlock(
  block: CardanoBlock,
  filter?: CardanoBlockFilter,
): CardanoBlock | undefined {
  // TODO: Filter block cardano
  return block;
  // if (!filter) return block;
  // if (!filterBlockModulo(block, filter)) return;
  // if (
  //   !filterBlockTimestamp(
  //     block.timestamp.getTime(),
  //     filter as SubqlProjectBlockFilter,
  //   )
  // ) {
  //   return;
  // }
  // return filter.specVersion === undefined ||
  //   block.specVersion === undefined ||
  //   checkSpecRange(filter.specVersion, block.specVersion)
  //   ? block
  //   : undefined;
}

export function filterExtrinsic(
  { block, extrinsic, success }: CardanoExtrinsic,
  filter?: CardanoCallFilter,
): boolean {
  // TODO: for cardano
  return true;
  // if (!filter) return true;
  // return (
  //   (filter.specVersion === undefined ||
  //     block.specVersion === undefined ||
  //     checkSpecRange(filter.specVersion, block.specVersion)) &&
  //   (filter.module === undefined ||
  //     extrinsic.method.section === filter.module) &&
  //   (filter.method === undefined ||
  //     extrinsic.method.method === filter.method) &&
  //   (filter.success === undefined || success === filter.success) &&
  //   (filter.isSigned === undefined || extrinsic.isSigned === filter.isSigned)
  // );
}

/**
 *
 * @param api
 * @param startHeight
 * @param endHeight
 * @param overallSpecVer exists if all blocks in the range have same parant specVersion
 */

export async function fetchBlockByHeight(
  api: CardanoClient,
  height: number,
): Promise<BlockFetchBlock> {
  return retryFetchBlockByHeight(async () => {
    const chainTip = await getChainTipByHeight(height);
    if (!chainTip) throw new Error(`Not found chain tip for height ${height}`);

    const chainPoint = chainTip.point;
    return timeout(
      api.fetchBlockByPoint(chainPoint),
      10,
      `Fetch block by height ${chainTip.blockNo} timeout.`,
    );
  }, MAX_RECONNECT_ATTEMPTS);
}

async function retryFetchBlockByHeight(
  fn: () => Promise<BlockFetchBlock>,
  numAttempts = MAX_RECONNECT_ATTEMPTS,
): Promise<BlockFetchBlock> {
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

export function calcInterval(api: CardanoClient): number {
  // TODO find a way to get this from the blockchain
  return 6000;
}
export class LazyBlockContent implements CardanoBlockContent {
  constructor(
    private multiEraBlock: MultiEraBlock,
    private cborHexBlock: string,
  ) {}

  get block() {
    return {
      multiEraBlock: this.multiEraBlock,
      cborHexBlock: this.cborHexBlock,
    };
  }

  get events() {
    // TODO: get event IBC cardano from transaction body in block header
    return [];
  }
}
