import {
  CacheModuleOptions,
  CacheOptionsFactory,
  Injectable,
} from '@nestjs/common';
import * as redisStore from 'cache-manager-redis-store';

@Injectable()
export class CacheConfigFactory implements CacheOptionsFactory {
  createCacheOptions(): CacheModuleOptions {
    return {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
      store: redisStore,
      ttl: 24 * 60 * 60,
    };
  }
}
