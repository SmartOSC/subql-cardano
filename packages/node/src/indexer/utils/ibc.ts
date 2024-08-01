import { Data, Datum, Exact, Redeemer } from '../../ibc-types/plutus/data';

export function decodeCborHex<T>(cborHex: string, type: T): T {
  return Data.from(cborHex, type);
}

export function encodeCborObj<T = Data>(
  data: Exact<T>,
  type?: T,
): Datum | Redeemer {
  return Data.to<T>(data, type);
}
