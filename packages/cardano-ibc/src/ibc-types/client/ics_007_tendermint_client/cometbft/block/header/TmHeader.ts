import {Data} from '../../../../../plutus/data';
import {ConsensusSchema} from '../../protos/types_pb/Consensus';
import {BlockIDSchema} from '../block_id/BlockID';

export const TmHeaderSchema = Data.Object({
  version: ConsensusSchema,
  chain_id: Data.Bytes(),
  height: Data.Integer(),
  time: Data.Integer(),
  last_block_id: BlockIDSchema,
  last_commit_hash: Data.Bytes(),
  data_hash: Data.Bytes(),
  validators_hash: Data.Bytes(),
  next_validators_hash: Data.Bytes(),
  consensus_hash: Data.Bytes(),
  app_hash: Data.Bytes(),
  last_results_hash: Data.Bytes(),
  evidence_hash: Data.Bytes(),
  proposer_address: Data.Bytes(),
});
export type TmHeader = Data.Static<typeof TmHeaderSchema>;
export const TmHeader = TmHeaderSchema as unknown as TmHeader;
