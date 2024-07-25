import {
  ChainSyncRollForward,
  IChainSyncRollBackwards,
  IChainTip,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import Redis from 'ioredis';
import { fromHex, toHex } from '../indexer/utils/hex';

// Create a Redis client
export const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

export interface IBlockHeaderHash {
  readonly slot: number | bigint;
  readonly hash: string;
}

interface IChainPoint {
  blockHeader?: IBlockHeaderHash;
}
interface IChainTipSchema {
  point: IChainPoint;
  blockNo: number | bigint;
}

interface IChainSyncRollBackwardsInstance {
  point: IChainPoint;
  tip: IChainTipSchema;
}

export async function getChainTipByHeight(
  height: number,
): Promise<IChainTip | null> {
  try {
    const tipChain = await redis.get(`block-${height}`);
    if (!tipChain) return null;

    const chainSyncRollBackwards = JSON.parse(
      JSON.parse(tipChain),
    ) as unknown as IChainSyncRollBackwardsInstance;

    return {
      point: {
        blockHeader: {
          hash: fromHex(
            chainSyncRollBackwards.tip.point.blockHeader?.hash ?? '',
          ),
          slotNumber: Number(
            chainSyncRollBackwards.tip.point.blockHeader?.slot ?? 0,
          ),
        },
      },
      blockNo: chainSyncRollBackwards.tip.blockNo,
    };
  } catch (error) {
    console.error('ERR getChainTipByHeight: ', error);
  }

  return null;
}
