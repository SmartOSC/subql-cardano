import {
  ChainSyncRollForward,
  IChainSyncRollBackwards,
  IChainTip,
} from '@harmoniclabs/ouroboros-miniprotocols-ts';
import Redis from 'ioredis';
import { fromHex, toHex } from '../indexer/utils/hex';

// Create a Redis client
export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
});
export interface IBlockHeaderHash {
  readonly slotNumber: string;
  readonly hash: string;
}

export interface IChainPointSchema {
  blockHeader?: IBlockHeaderHash;
}
export interface IChainTipSchema {
  point: IChainPointSchema;
  blockNo: string;
}

export async function getChainTipByHeight(
  height: number,
): Promise<IChainTip | null> {
  try {
    const point = await redis.get(`smart:cache:block-${height}`);
    if (!point) return null;

    const chainPoint = JSON.parse(
      JSON.parse(point),
    ) as unknown as IChainTipSchema;

    return {
      point: {
        blockHeader: {
          hash: fromHex(chainPoint.point.blockHeader?.hash ?? ''),
          slotNumber: Number(chainPoint.point.blockHeader?.slotNumber ?? 0),
        },
      },
      blockNo: BigInt(chainPoint.blockNo),
    };
  } catch (error) {
    console.error('ERR getChainTipByHeight: ', error);
  }

  return null;
}
