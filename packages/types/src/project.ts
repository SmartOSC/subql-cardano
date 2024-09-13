// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {ApiPromise} from '@polkadot/api';
import {AnyTuple} from '@polkadot/types/types';
import {
  BaseTemplateDataSource,
  IProjectNetworkConfig,
  CommonSubqueryProject,
  FileReference,
  Processor,
  ProjectManifestV1_0_0,
  BlockFilter,
  BaseDataSource,
  BaseHandler,
  BaseMapping,
  BaseCustomDataSource,
  HandlerInputTransformer_0_0_0 as BaseHandlerInputTransformer_0_0_0,
  HandlerInputTransformer_1_0_0 as BaseHandlerInputTransformer_1_0_0,
  SecondLayerHandlerProcessor_0_0_0,
  SecondLayerHandlerProcessor_1_0_0,
  DsProcessor,
} from '@subql/types-core';
import {LightCardanoEvent, CardanoBlock, CardanoEvent, CardanoExtrinsic} from './interfaces';

export type RuntimeDatasourceTemplate = BaseTemplateDataSource<CardanoDatasource>;
export type CustomDatasourceTemplate = BaseTemplateDataSource<CardanoCustomDatasource>;

export type CardanoProjectManifestV1_0_0 = ProjectManifestV1_0_0<CardanoRuntimeDatasource | CardanoCustomDatasource>;

/**
 * Kind of Cardano datasource.
 * @enum {string}
 */
export enum CardanoDatasourceKind {
  /**
   * The runtime kind of Cardano datasource.
   */
  Runtime = 'cardano/Runtime',
}

/**
 * Enum representing the kind of Cardano handler.
 * @enum {string}
 */
export enum CardanoHandlerKind {
  /**
   * Handler for Cardano blocks.
   */
  Block = 'cardano/BlockHandler',
  /**
   * Handler for Cardano extrinsic calls.
   */
  Call = 'cardano/CallHandler',
}

export type RuntimeHandlerInputMap<T extends AnyTuple = AnyTuple> = {
  // [CardanoHandlerKind.Block]: CardanoBlock;
  [CardanoHandlerKind.Block]: string;
  // [CardanoHandlerKind.CardanoBlock]: string;
  // [CardanoHandlerKind.Event]: CardanoEvent<T> | LightCardanoEvent<T>;
  [CardanoHandlerKind.Call]: CardanoExtrinsic<T>;
};

type RuntimeFilterMap = {
  [CardanoHandlerKind.Block]: CardanoBlockFilter;
  // [CardanoHandlerKind.CardanoBlock]: CardanoBlockFilter;
  // [CardanoHandlerKind.Event]: CardanoEventFilter;
  [CardanoHandlerKind.Call]: CardanoCallFilter;
};

// [startSpecVersion?, endSpecVersion?] closed range
export type SpecVersionRange = [number, number];

interface CardanoBaseHandlerFilter {
  specVersion?: SpecVersionRange;
}

/**
 * Represents a filter for Cardano blocks, extending CardanoBaseHandlerFilter.
 * @interface
 * @extends {CardanoBaseHandlerFilter}
 */
export interface CardanoBlockFilter extends CardanoBaseHandlerFilter, BlockFilter {}

/**
 * Represents a filter for Cardano events, extending CardanoBaseHandlerFilter.
 * @interface
 * @extends {CardanoBaseHandlerFilter}
 */
export interface CardanoEventFilter extends CardanoBaseHandlerFilter {
  /**
   * The module name for filtering events or calls (optional).
   * @type {string}
   * @example
   * module: 'balances'
   */
  module?: string;

  /**
   * The method name for filtering events calls (case-sensitive) (optional).
   * @type {string}
   * @example
   * method: 'Transfer'
   */
  method?: string;
}

/**
 * Represents a filter for Cardano calls, extending CardanoEventFilter.
 * @interface
 * @extends {CardanoEventFilter}
 * @example
 * filter: {
 * module: 'balances',
 * method: 'Deposit',
 * success: true,
 * }
 */
export interface CardanoCallFilter extends CardanoEventFilter {
  /**
   * Indicates whether the call was successful (optional).
   * @type {boolean}
   */
  success?: boolean;

  /**
   * Indicates whether the call is signed (optional).
   * @type {boolean}
   */
  isSigned?: boolean;
}

// /**
//  * Represents a handler for Substrate blocks.
//  * @type {SubstrateCustomHandler<SubstrateHandlerKind.Block, SubstrateBlockFilter>}
//  */
// export type SubstrateBlockHandler = SubstrateCustomHandler<SubstrateHandlerKind.Block, SubstrateBlockFilter>;

/**
 * Represents a handler for Cardano blocks.
 * @type {CardanoCustomHandler<CardanoCustomHandler.Block, SubstrateBlockFilter>}
 */
export type CardanoBlockHandler = CardanoCustomHandler<CardanoHandlerKind.Block, CardanoBlockFilter>;

/**
 * Represents a handler for Cardano calls.
 * @type {CardanoCustomHandler<CardanoHandlerKind.Call, CardanoCallFilter>}
 */
export type CardanoCallHandler = CardanoCustomHandler<CardanoHandlerKind.Call, CardanoCallFilter>;

// /**
//  * Represents a handler for Cardano events.
//  * @type {CardanoCustomHandler<CardanoHandlerKind.Event, CardanoEventFilter>}
//  */
// export type CardanoEventHandler = CardanoCustomHandler<CardanoHandlerKind.Event, CardanoEventFilter>;

/**
 * Represents a generic custom handler for Cardano.
 * @interface
 * @template K - The kind of the handler (default: string).
 * @template F - The filter type for the handler (default: Record<string, unknown>).
 */
export interface CardanoCustomHandler<K extends string = string, F = Record<string, unknown>>
  extends BaseHandler<F, K> {
  /**
   * The kind of handler. For `Cardano/Runtime` datasources this is either `Block`, `Call` or `Event` kinds.
   * The value of this will determine the filter options as well as the data provided to your handler function
   * @type {CardanoHandlerKind.Block | CardanoHandlerKind.Call | string }
   * @example
   * kind: CardanoHandlerKind.Block // Defined with an enum, this is used for runtime datasources
   * @example
   * kind: 'Cardano/FrontierEvmEvent' // Defined with a string, this is used with custom datasources
   */
  kind: K;
  /**
   * @type {F}
   * @example
   * filter: {
   *   module: 'balances',
   *   method: 'Deposit',
   *   success: true,
   * } // A Call filter
   */
  filter?: F;
}

/**
 * Represents a runtime handler for Cardano, which can be a block handler, call handler, or event handler.
 * @type {CardanoBlockHandler | CardanoCallHandler}
 */
export type CardanoRuntimeHandler = CardanoBlockHandler | CardanoCallHandler;

/**
 * Represents a handler for Cardano, which can be a runtime handler or a custom handler with unknown filter type.
 * @type {CardanoRuntimeHandler | CardanoCustomHandler<string, unknown>}
 */
export type CardanoHandler = CardanoRuntimeHandler | CardanoCustomHandler<string, unknown>;

/**
 * Represents a filter for Cardano runtime handlers, which can be a block filter, call filter, or event filter.
 * @type {CardanoBlockFilter | CardanoCallFilter}
 */
export type CardanoRuntimeHandlerFilter = CardanoBlockFilter | CardanoCallFilter;

/**
 * Represents a mapping for Cardano handlers, extending FileReference.
 * @interface
 * @extends {FileReference}
 */
export interface CardanoMapping<T extends CardanoHandler = CardanoHandler> extends BaseMapping<T> {
  /**
   * @type {T[]}
   * @example
   * handlers: [{
        kind: CardanoHandlerKind.Call,
        handler: 'handleCall',
        filter: {
          module: 'balances',
          method: 'Deposit',
          success: true,
        }
      }]
   */
  handlers: T[];
}

/**
 * Represents a Cardano datasource interface with generic parameters.
 * @interface
 * @template M - The mapping type for the datasource.
 */
type ICardanoDatasource<M extends CardanoMapping> = BaseDataSource<CardanoHandler, M>;

/**
 * Represents a runtime datasource for Cardano.
 * @interface
 * @template M - The mapping type for the datasource (default: CardanoMapping<CardanoRuntimeHandler>).
 */
export interface CardanoRuntimeDatasource<
  M extends CardanoMapping<CardanoRuntimeHandler> = CardanoMapping<CardanoRuntimeHandler>,
> extends ICardanoDatasource<M> {
  /**
   * The kind of the datasource, which is `Cardano/Runtime`.
   * @type {CardanoDatasourceKind.Runtime}
   */
  kind: CardanoDatasourceKind.Runtime;
}

/**
 * Represents a Cardano datasource, which can be either runtime or custom.
 * @type {CardanoDatasource}
 */
export type CardanoDatasource = CardanoRuntimeDatasource | CardanoCustomDatasource;

/**
 * Represents a custom datasource for Cardano.
 * @interface
 * @template K - The kind of the datasource (default: string).
 * @template M - The mapping type for the datasource (default: CardanoMapping<CardanoCustomHandler>).
 * @template O - The processor options (default: any).
 */
export interface CardanoCustomDatasource<
  K extends string = string,
  M extends CardanoMapping = CardanoMapping<CardanoCustomHandler>,
  O = any,
> extends BaseCustomDataSource<CardanoHandler, M> {
  startSlot?: number;
  startBlockHash?: string;
  /**
   * The kind of the custom datasource. This should follow the pattern `Cardano/*`.
   * @type {K}
   * @example
   * kind: 'Cardano/FrontierEvm'
   */
  kind: K;

  /**
   * @example
   * processor: {
   *    file: './node_modules/@subql/frontier-evm-processor/dist/bundle.js',
   *    options: {
   *      abi: 'erc20',
   *      address: '0x322E86852e492a7Ee17f28a78c663da38FB33bfb',
   *    }
   *  }
   */
  processor: Processor<O>;
}

/**
 * @deprecated use types core version. datasource processors need updating before this can be removed
 * */
export type HandlerInputTransformer_0_0_0<
  IT extends AnyTuple,
  IM extends RuntimeHandlerInputMap<IT>,
  T extends CardanoHandlerKind,
  E,
  DS extends CardanoCustomDatasource = CardanoCustomDatasource,
> = BaseHandlerInputTransformer_0_0_0<IM, T, DS, ApiPromise, E>;

/**
 * @deprecated use types core version. datasource processors need updating before this can be removed
 * */
export type HandlerInputTransformer_1_0_0<
  IT extends AnyTuple,
  IM extends RuntimeHandlerInputMap<IT>,
  T extends CardanoHandlerKind,
  F extends Record<string, unknown>,
  E,
  DS extends CardanoCustomDatasource = CardanoCustomDatasource,
> = BaseHandlerInputTransformer_1_0_0<IM, T, DS, ApiPromise, F, E>;

export type SecondLayerHandlerProcessorArray<
  K extends string,
  F extends Record<string, unknown>,
  T,
  DS extends CardanoCustomDatasource<K> = CardanoCustomDatasource<K>,
> =
  | SecondLayerHandlerProcessor<CardanoHandlerKind.Block, F, T, DS>
  | SecondLayerHandlerProcessor<CardanoHandlerKind.Call, F, T, DS>;

/**
 * @deprecated use types core version. datasource processors need updating before this can be removed
 * */
export type CardanoDatasourceProcessor<
  K extends string,
  F extends Record<string, unknown>,
  DS extends CardanoCustomDatasource<K> = CardanoCustomDatasource<K>,
  P extends Record<string, SecondLayerHandlerProcessorArray<K, F, any, DS>> = Record<
    string,
    SecondLayerHandlerProcessorArray<K, F, any, DS>
  >,
> = DsProcessor<DS, P, ApiPromise>;

export type SecondLayerHandlerProcessor<
  K extends CardanoHandlerKind,
  F extends Record<string, unknown>,
  E,
  DS extends CardanoCustomDatasource = CardanoCustomDatasource,
> =
  | SecondLayerHandlerProcessor_0_0_0<RuntimeFilterMap, K, F, E, DS, ApiPromise>
  | SecondLayerHandlerProcessor_1_0_0<RuntimeFilterMap, K, F, E, DS, ApiPromise>;

/**
 * Represents a Cardano subquery network configuration, which is based on the CommonSubqueryNetworkConfig template.
 * @type {IProjectNetworkConfig}
 */
export type CardanoNetworkConfig = IProjectNetworkConfig & {
  /**
   * The chain types associated with the network (optional).
   * @type {FileReference}
   */
  chaintypes?: FileReference; // Align with previous field name

  /**
   * The network magic number,
   *
   * @type {number}
   */
  networkMagic?: number;

  /**
   * The system start time in milliseconds
   *
   * @type {number}
   */
  systemStartTime: number;

  /**
   * The slot length
   *
   * @type {number}
   */
  slotLength: number;
};

/**
 * Represents a Cardano project configuration based on the CommonSubqueryProject template.
 * @type {CommonSubqueryProject<CardanoNetworkConfig, CardanoDatasource, RuntimeDatasourceTemplate | CustomDatasourceTemplate>}
 */
export type CardanoProject<DS extends CardanoDatasource = CardanoRuntimeDatasource> = CommonSubqueryProject<
  CardanoNetworkConfig,
  CardanoRuntimeDatasource | DS,
  BaseTemplateDataSource<CardanoRuntimeDatasource> | BaseTemplateDataSource<DS>
>;
