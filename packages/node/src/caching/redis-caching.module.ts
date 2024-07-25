import { CacheModule, Module } from '@nestjs/common';
import { RedisOptions } from 'ioredis';
import { RedisCachingService } from './redis-caching.service';
import { CacheConfigFactory } from './caching-config.factory';

@Module({
  imports: [
    CacheModule.registerAsync<RedisOptions>({
      useClass: CacheConfigFactory,
    }),
  ],
  providers: [RedisCachingService],
  exports: [RedisCachingService],
})
export class RedisCachingModule {}
