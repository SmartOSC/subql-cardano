import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCachingService {
  constructor(@Inject(CACHE_MANAGER) public readonly cacheManager: Cache) {}

  /**
   * Retrieve the cached value via cache-key.
   * @param identity a caching key for redis to store the value.
   * @param transformer Transform the data from `string` | `number` | `Buffer` to specific kind of type value.
   */
  async get<T = string>(
    identity: string,
    transformer?: (val: T | undefined) => T,
  ): Promise<T | undefined> {
    const val = await this.cacheManager.get<T>(
      this.constructIdentity(identity),
    );
    if (transformer) {
      return transformer(val);
    }
    return val as unknown as T;
  }

  /**
   * Set the value to Redis.
   * @param identity A caching key for redis to store the value.
   * @param value The original value. Prefer `string` | `number` | `Buffer`.
   * @param opts Caching option.
   * @param opts.transformer Transform the raw data to suitable type for Redis to store (`string` | `number` | `Buffer`).
   * If the original value is not in suitable type, and this function is not provided, it will throw error in runtime.
   * @param opts.ttl Time to cache the data (in second). Default `undefined`, which is not to be expired.
   */
  async set<T>(
    identity: string,
    value: T,
    opts?: {
      transformer?: (val: T) => string | number | Buffer;
      // in seconds
      ttl?: number;
    },
  ): Promise<boolean> {
    const { transformer, ttl } = opts ?? {};
    let val = value as string | number | Buffer;
    if (transformer) {
      val = transformer(value);
    }
    await this.cacheManager.set(
      this.constructIdentity(identity),
      value,
      opts?.ttl ?? 30,
    );
    return true;
  }

  /**
   * Retrieve the actual key stored in the redis.
   * The actual key has a prefix which is the service identity.
   * @param rawIdentity
   * @private
   */
  protected constructIdentity(rawIdentity: string) {
    return rawIdentity;
  }
}
