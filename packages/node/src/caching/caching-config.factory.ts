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
      host: 'localhost',
      port: '6379',
      store: redisStore,
      ttl: 24 * 60 * 60,
    };
  }
}
