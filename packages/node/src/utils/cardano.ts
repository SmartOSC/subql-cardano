import { Header, IBlock } from '@subql/node-core';
import { BlockContent } from '../indexer/types';
import { CardanoClient } from '../indexer/cardano/CardanoClient';

export async function fetchBlocksBatches(
  api: CardanoClient,
  blockArray: number[],
): Promise<IBlock<BlockContent>[]> {
  // TODO: implement
  console.log({
    api,
    blockArray,
  });

  return [];
}

/**
 *
 * @param api
 * @param startHeight
 * @param endHeight
 * @param overallSpecVer exists if all blocks in the range have same parant specVersion
 */

export async function getBlockByHeight(
  api: CardanoClient,
  height: number,
): Promise<any> {
  // TODO: implement
  // get point (slot + block_hash) from height
  // start height: block_hash, slot, height
  return null;
}

export function calcInterval(api: CardanoClient): number {
  // TODO find a way to get this from the blockchain
  return 6000;
}

/*
 * Cardano has instant finalization, there is also no rpc method to get a block by hash
 * To get around this we use blockHeights as hashes
 */
export function cardanoBlockToHeader(blockHeight: number): Header {
  return {
    blockHeight: blockHeight,
    blockHash: blockHeight.toString(),
    parentHash: (blockHeight - 1).toString(),
  };
}
