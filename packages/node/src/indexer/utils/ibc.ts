import { Data } from '../../ibc-types/plutus/data';

export function decodeCborHex<T>(cborHex: string, type: T): T {
  return Data.from(cborHex, type);
}
