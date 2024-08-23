// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {RegisteredTypes, RegistryTypes, OverrideModuleType, OverrideBundleType} from '@polkadot/types/types';
import {BaseDataSource, BlockFilterImpl, ProcessorImpl} from '@subql/common';
import {
  CardanoBlockFilter,
  CardanoBlockHandler,
  CardanoCallFilter,
  CardanoCallHandler,
  CardanoCustomHandler,
  CardanoDatasourceKind,
  CardanoEventFilter,
  // CardanoEventHandler,
  CardanoHandlerKind,
  // CardanoBlockHandler,
  CardanoRuntimeDatasource,
  CardanoRuntimeHandler,
  CardanoCustomDatasource,
} from '@subql/types';
import {BaseMapping, FileReference, Processor} from '@subql/types-core';
import {plainToClass, Transform, Type} from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
} from 'class-validator';

export class BlockFilter extends BlockFilterImpl implements CardanoBlockFilter {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  specVersion?: [number, number];
}

export class EventFilter implements CardanoEventFilter {
  @IsOptional()
  @IsString()
  module?: string;
  @IsOptional()
  @IsString()
  method?: string;
}

export class ChainTypes implements RegisteredTypes {
  @IsObject()
  @IsOptional()
  types?: RegistryTypes;
  @IsObject()
  @IsOptional()
  typesAlias?: Record<string, OverrideModuleType>;
  @IsObject()
  @IsOptional()
  typesBundle?: OverrideBundleType;
  @IsObject()
  @IsOptional()
  typesChain?: Record<string, RegistryTypes>;
  @IsObject()
  @IsOptional()
  typesSpec?: Record<string, RegistryTypes>;
}

export class CallFilter extends EventFilter implements CardanoCallFilter {
  @IsOptional()
  @IsBoolean()
  success?: boolean;
  @IsOptional()
  @IsBoolean()
  isSigned?: boolean;
}

export class BlockHandler implements CardanoBlockHandler {
  @IsOptional()
  @ValidateNested()
  @Type(() => BlockFilter)
  filter?: CardanoBlockFilter;
  @IsEnum(CardanoHandlerKind, {groups: [CardanoHandlerKind.Block]})
  kind!: CardanoHandlerKind.Block;
  @IsString()
  handler!: string;
}

export class CallHandler implements CardanoCallHandler {
  @IsOptional()
  @ValidateNested()
  @Type(() => CallFilter)
  filter?: CardanoCallFilter;
  @IsEnum(CardanoHandlerKind, {groups: [CardanoHandlerKind.Call]})
  kind!: CardanoHandlerKind.Call;
  @IsString()
  handler!: string;
}

// export class EventHandler implements SubstrateEventHandler {
//   @IsOptional()
//   @ValidateNested()
//   @Type(() => EventFilter)
//   filter?: CardanoEventFilter;
//   @IsEnum(SubstrateHandlerKind, {groups: [SubstrateHandlerKind.Event]})
//   kind!: SubstrateHandlerKind.Event;
//   @IsString()
//   handler!: string;
// }

export class CustomHandler implements CardanoCustomHandler {
  @IsString()
  kind!: string;
  @IsString()
  handler!: string;
  @IsObject()
  @IsOptional()
  filter?: Record<string, unknown>;
}

export class RuntimeMapping implements BaseMapping<CardanoRuntimeHandler> {
  @Transform((params) => {
    const handlers: CardanoRuntimeHandler[] = params.value;
    return handlers.map((handler) => {
      switch (handler.kind) {
        case CardanoHandlerKind.Call:
          return plainToClass(CallHandler, handler);
        case CardanoHandlerKind.Block:
          return plainToClass(BlockHandler, handler);
        // case CardanoHandlerKind.CardanoBlock:
        //   return plainToClass(BlockHandler, handler);
        default:
          throw new Error(`handler ${(handler as any).kind} not supported`);
      }
    });
  })
  @IsArray()
  @ValidateNested()
  handlers!: CardanoRuntimeHandler[];
  @IsString()
  file!: string;
}

export class CustomMapping implements BaseMapping<CardanoCustomHandler> {
  @IsArray()
  @Type(() => CustomHandler)
  @ValidateNested()
  handlers!: CustomHandler[];
  @IsString()
  file!: string;
}

export class RuntimeDataSourceBase extends BaseDataSource implements CardanoRuntimeDatasource {
  @IsEnum(CardanoDatasourceKind, {groups: [CardanoDatasourceKind.Runtime]})
  kind!: CardanoDatasourceKind.Runtime;
  @Type(() => RuntimeMapping)
  @ValidateNested()
  mapping!: RuntimeMapping;
}

export class FileReferenceImpl implements FileReference {
  @IsString()
  file!: string;
}

export class CustomDataSourceBase<K extends string, M extends CustomMapping, O = any>
  extends BaseDataSource
  implements CardanoCustomDatasource<K, M, O>
{
  @IsString()
  kind!: K;
  @Type(() => CustomMapping)
  @ValidateNested()
  mapping!: M;
  @Type(() => FileReferenceImpl)
  @ValidateNested({each: true})
  assets!: Map<string, FileReference>;
  @Type(() => ProcessorImpl)
  @IsObject()
  @ValidateNested()
  processor!: Processor<O>;
}
