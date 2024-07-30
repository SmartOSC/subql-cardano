import {sha3_256} from 'js-sha3';
import {blake2b} from 'blakejs';
import {hexToBytes} from './hex';

export type AuthToken = {
  policyId: string;
  name: string;
};

export function generateTokenName(authToken: AuthToken, prefix: string, postfix: ''): string {
  const postfixHex = convertString2Hex(postfix.toString());
  if (postfixHex.length > 16) throw new Error('postfix size > 8 bytes');
  const baseTokenPart = hashSha3_256(authToken.policyId + authToken.name).slice(0, 40);
  const prefixPart = hashSha3_256(prefix).slice(0, 8);
  const fullName = baseTokenPart + prefixPart + postfixHex;
  return fullName;
}

export function getIdFromTokenName(tokenName: string, baseToken: AuthToken, prefix: string): string {
  const baseTokenPart = hashSha3_256(baseToken.policyId + baseToken.name).slice(0, 40);
  const prefixPart = hashSha3_256(prefix).slice(0, 8);
  const prefixFull = baseTokenPart + prefixPart;

  if (!tokenName.includes(prefixFull)) return '';
  const idHex = tokenName.replace(prefixFull, '');

  return Buffer.from(hexToBytes(idHex)).toString();
}

export function hashSha3_256(data: string): string {
  const hash = sha3_256(Buffer.from(data).toString('hex')).toString();
  return hash;
}

export function convertString2Hex(str: string) {
  if (!str) return '';
  return Buffer.from(str).toString('hex');
}

export const createHash32 = (buffer: Uint8Array) => {
  const hash = blake2b(buffer, undefined, 32);
  return Buffer.from(hash).toString('hex');
};
