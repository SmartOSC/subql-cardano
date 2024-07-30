import {AuthToken, generateTokenName, getIdFromTokenName} from './utils';

export class TokenAsset {
  name: string;
  quantity: bigint;
  constructor(name: string, quantity: bigint) {
    this.name = name;
    this.quantity = quantity;
  }
}
export function getIdFromTokenAssets(assets: Map<string, TokenAsset[]>, baseToken: AuthToken, prefix: string): string {
  const tokenPrefix = generateTokenName(baseToken, prefix, '');
  for (const [_, tokenAssets] of assets.entries()) {
    const idx = tokenAssets.findIndex((e) => e.name.startsWith(tokenPrefix));
    if (idx !== -1) {
      return getIdFromTokenName(tokenAssets[idx].name, baseToken, prefix);
    }
  }
  return '';
}
