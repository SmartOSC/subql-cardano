// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { isMainThread } from 'worker_threads';
import { Inject, Injectable } from '@nestjs/common';
import { BaseDataSource, Store } from '@subql/types-core';
import {
  ISubqueryProject,
  InMemoryCacheService,
  IndexerSandbox,
  NodeConfig,
  SandboxService,
  StoreService,
  hostStoreToStore,
} from '@subql/node-core';
import { CardanoClient } from './cardano/CardanoClient';
import { CardanoSafeClient } from './cardano/cardanoClient.connection';
import {
  AlonzoFormatTxOut,
  BabbageBlock,
  BabbageFormatTxOut,
  BabbageTransactionBody,
  BabbageTransactionBodyList,
  MapAssetNameToCoin,
  MultiAsset,
  MultiEraBlock,
  PlutusData,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import { option } from 'yargs';
import {
  extractTxOutput,
  getIdFromTokenAssets,
  hasTokenPrefix,
} from './utils/utxo';
import { decodeCborHex, encodeCborObj } from './utils/ibc';
import { generateTokenName } from './utils/utils';
import { hashSha3_256 } from './utils/hex';

export class TokenAsset {
  name: string;
  quantity: bigint;
  constructor(name: string, quantity: bigint) {
    this.name = name;
    this.quantity = quantity;
  }
}

export class TxOutput {
  hash: string;
  txIndex: number;
  outputIndex: number;
  address: string;
  datum: string;
  datum_plutus: PlutusData;
  assets: Map<string, TokenAsset[]>;

  constructor(
    hash: string,
    txIndex: number,
    outputIndex: number,
    address: string,
    datum: string,
    datum_plutus: PlutusData,
    assets: Map<string, TokenAsset[]>,
  ) {
    this.hash = hash;
    this.txIndex = txIndex;
    this.outputIndex = outputIndex;
    this.address = address;
    this.datum = datum;
    this.datum_plutus = datum_plutus;
    this.assets = assets;
  }
}

/* It would be nice to move this to node core but need to find a way to inject other things into the sandbox */
@Injectable()
export class CustomSandboxService extends SandboxService<
  CardanoClient,
  CardanoSafeClient
> {
  private _processorCache: Record<string, IndexerSandbox> = {};

  constructor(
    @Inject(isMainThread ? StoreService : 'Null')
    private readonly _storeService: StoreService,
    private readonly _cacheService: InMemoryCacheService,
    private readonly _nodeConfig: NodeConfig,
    @Inject('ISubqueryProject') private readonly _project: ISubqueryProject,
  ) {
    super(_storeService, _cacheService, _nodeConfig, _project);
  }

  getDsProcessor(
    ds: BaseDataSource,
    api: CardanoClient,
    unsafeApi: CardanoSafeClient,
    extraInjections: Record<string, any> = {},
  ): IndexerSandbox {
    const store: Store = isMainThread
      ? this._storeService.getStore()
      : hostStoreToStore((global as any).host); // Provided in worker.ts

    const cache = this._cacheService.getCache();
    const entry = this._getDataSourceEntry(ds);
    let processor = this._processorCache[entry];
    if (!processor) {
      processor = new IndexerSandbox(
        {
          cache,
          store,
          root: this._project.root,
          entry,
          chainId: this._project.network.chainId,
        },
        this._nodeConfig,
      );
      this._processorCache[entry] = processor;
    }
    // Run this before injecting other values so they cannot be overwritten
    for (const [key, value] of Object.entries(extraInjections)) {
      processor.freeze(value, key);
    }
    processor.freeze(api, 'api');
    if (this._nodeConfig.unsafe) {
      processor.freeze(unsafeApi, 'unsafeApi');
    }
    processor.freeze(this._project.network.chainId, 'chainId');

    // inject customize function
    processor.setGlobal(
      'getBabbageTransactionBodies',
      this.getBabbageTransactionBodies,
    );
    processor.setGlobal(
      'getBabbageTransactionBodyByIndex',
      this.getBabbageTransactionBodyByIndex,
    );
    processor.setGlobal(
      'from_explicit_network_cbor_bytes',
      this.from_explicit_network_cbor_bytes,
    );
    processor.setGlobal(
      'getMultiEraBlockFromCborHex',
      this.getMultiEraBlockFromCborHex,
    );
    processor.setGlobal('extractTxOutput', extractTxOutput);
    processor.setGlobal('hasTokenPrefix', hasTokenPrefix);
    processor.setGlobal('decodeCborHex', decodeCborHex);
    processor.setGlobal('encodeCborObj', encodeCborObj);
    processor.setGlobal('generateTokenName', generateTokenName);
    processor.setGlobal('getIdFromTokenAssets', getIdFromTokenAssets);
    processor.setGlobal('hashSha3_256', hashSha3_256);
    processor.setGlobal('getProjectNetwork', this._project.network);
    return processor;
  }

  protected _getDataSourceEntry(ds: BaseDataSource): string {
    return ds.mapping.file;
  }

  from_explicit_network_cbor_bytes(bytes: Uint8Array): MultiEraBlock {
    return MultiEraBlock.from_explicit_network_cbor_bytes(bytes);
  }

  getMultiEraBlockFromCborHex(cborBytes: string): MultiEraBlock {
    const result = MultiEraBlock.from_cbor_hex(cborBytes);
    return result;
  }

  // customize function inject to vm
  getBabbageTransactionBodies(block: any): BabbageTransactionBodyList {
    if (!block) throw new Error('Block is empty');

    const multiEraBlock = block as unknown as MultiEraBlock;
    const bodies = multiEraBlock.as_babbage()?.transaction_bodies();
    if (!bodies) throw new Error('Transaction Bodies is empty');

    return bodies as BabbageTransactionBodyList;
  }

  getBabbageTransactionBodyByIndex(
    list: BabbageTransactionBodyList,
    index: number,
  ): BabbageTransactionBody {
    return list.get(index);
  }
}
