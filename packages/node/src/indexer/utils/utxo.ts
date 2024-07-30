import {
  BabbageTransactionBody,
  BabbageTransactionBodyList,
  MultiAsset,
  PlutusData,
  AlonzoFormatTxOut,
  BabbageFormatTxOut,
  MapAssetNameToCoin,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import {
  AuthToken,
  createHash32,
  generateTokenName,
  getIdFromTokenName,
} from './utils';

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

export function extractTxOutput(
  txBabbageBodies: BabbageTransactionBodyList,
): TxOutput[] {
  const outputs: TxOutput[] = [];
  for (let idx = 0; idx < txBabbageBodies.len(); idx++) {
    const body = txBabbageBodies.get(idx);
    const txOutputs = body.outputs();
    for (let subIdx = 0; subIdx < txOutputs.len(); subIdx++) {
      const output = txOutputs.get(subIdx);
      const kind = output.kind();
      const hash = getTransactionHashFromTxBody(body);
      switch (kind) {
        case 0: // Alonzo
          const alonzoTxOut =
            output.as_alonzo_format_tx_out() as AlonzoFormatTxOut;

          outputs.push({
            address: alonzoTxOut?.address().to_hex() ?? '',
            txIndex: idx,
            hash: hash,
            outputIndex: subIdx,
            datum: alonzoTxOut?.datum_hash()?.to_hex() ?? '',
            datum_plutus: new PlutusData(),
            assets: extractMultiAssets(alonzoTxOut.amount().multi_asset()),
          });

          break;
        case 1:
          const babbageTxOut =
            output.as_babbage_format_tx_out() as BabbageFormatTxOut;
          outputs.push({
            address: babbageTxOut.address().to_hex(),
            hash: hash,
            txIndex: idx,
            outputIndex: subIdx,
            datum: babbageTxOut.datum_option()?.as_datum()?.to_cbor_hex() ?? '',
            datum_plutus:
              babbageTxOut.datum_option()?.as_datum() ?? new PlutusData(),
            assets: extractMultiAssets(babbageTxOut.amount().multi_asset()),
          });
          break;
      }
    }
  }
  return outputs;
}

export function extractMultiAssets(
  multiAsset: MultiAsset,
): Map<string, TokenAsset[]> {
  const results = new Map<string, TokenAsset[]>();
  for (let idxKey = 0; idxKey < multiAsset.keys().len(); idxKey++) {
    const policyId = multiAsset.keys().get(idxKey);
    const assets = multiAsset.get_assets(policyId) as MapAssetNameToCoin;

    const tokenAssets: TokenAsset[] = [];
    for (let idxAssets = 0; idxAssets < assets.keys().len(); idxAssets++) {
      const assetName = assets.keys().get(idxAssets);
      const assetValue = assets.get(assetName);
      tokenAssets.push({
        name: assetName.to_js_value(),
        quantity: assetValue ?? BigInt(0),
      });
    }

    results.set(policyId.to_hex(), tokenAssets);
  }
  return results;
}

export function getTransactionHashFromTxBody(
  txBody: BabbageTransactionBody,
): string {
  return generateTransactionHash(txBody.to_cbor_bytes(), new Uint8Array());
}

export function generateTransactionHash(
  data: Uint8Array,
  prefix: Uint8Array,
): string {
  const bytes = data;
  if (!prefix.length) {
    bytes.set(prefix);
  }

  return createHash32(Buffer.from(bytes));
}

export function hasTokenPrefix(
  assets: Map<string, TokenAsset[]>,
  tokenPrefix: string,
): boolean {
  for (const [_, tokenAssets] of assets.entries()) {
    const idx = tokenAssets.findIndex((e) => e.name.startsWith(tokenPrefix));
    if (idx !== -1) return true;
  }
  return false;
}

export function getIdFromTokenAssets(
  assets: Map<string, TokenAsset[]>,
  baseToken: AuthToken,
  prefix: string,
): string {
  const tokenPrefix = generateTokenName(baseToken, prefix, '');
  for (const [_, tokenAssets] of assets.entries()) {
    const idx = tokenAssets.findIndex((e) => e.name.startsWith(tokenPrefix));
    if (idx !== -1) {
      return getIdFromTokenName(tokenAssets[idx].name, baseToken, prefix);
    }
  }
  return '';
}
