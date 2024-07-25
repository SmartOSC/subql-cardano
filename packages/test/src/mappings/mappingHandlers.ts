import {
  AlonzoRedeemerList,
  BabbageBlock,
  BabbageTransactionBodyList,
  MultiEraBlock as CardanoBlock,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import * as handler from '../contracts/handler.json';
import {generateTokenName} from '../utils/utils';
import {CHANNEL_TOKEN_PREFIX, CLIENT_PREFIX, CONNECTION_TOKEN_PREFIX} from '../constants';
import {TxOutput, extractTxOutput, getIdFromTokenAssets, hasTokenPrefix} from '../utils/utxo';
import {Data} from '../ibc-types/plutus/data';
import {ClientDatum} from '../ibc-types/client/ics_007_tendermint_client/client_datum/ClientDatum';
import {HandlerOperator} from '../ibc-types/core/ics_025_handler_interface/handler_redeemer/HandlerOperator';
import {SpendClientRedeemer} from '../ibc-types/client/ics_007_tendermint_client/client_redeemer/SpendClientRedeemer';
import {ConnectionDatum} from '../ibc-types/core/ics_003_connection_semantics/connection_datum/ConnectionDatum';
import {MintConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/MintConnectionRedeemer';
import {SpendConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/SpendConnectionRedeemer';
import {ChannelDatum} from '../ibc-types/core/ics_004/channel_datum/ChannelDatum';
import {MintChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/MintChannelRedeemer';
import {SpendChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/SpendChannelRedeemer';
import {Event, EventAttribute, EventType} from '../types';
import {EventAttributeClient} from '../constants/eventAttributes';
import {ClientMessage, ClientMessageSchema} from '../ibc-types/client/ics_007_tendermint_client/msgs/ClientMessage';

const handlerAuthToken = handler.handlerAuthToken;
const clientTokenPrefix = generateTokenName(handlerAuthToken, CLIENT_PREFIX, '');
const connectionTokenPrefix = generateTokenName(handlerAuthToken, CONNECTION_TOKEN_PREFIX, '');
const channelTokenPrefix = generateTokenName(handlerAuthToken, CHANNEL_TOKEN_PREFIX, '');

export async function handleCardanoBlock(block: CardanoBlock): Promise<void> {
  const event = Event.create({
    id: `asdas`,
    blockHeight: BigInt(100),
    txHash: 'txOutput.hash',
    type: EventType.CreateClient,
  });
  await event.save();
  console.log(`Handling an incoming block on Cardano from`);
  if (!block) return;

  if (!block.as_babbage()) return;
  const babbageBlock = block.as_babbage() as BabbageBlock;
  const blockHeight = babbageBlock.header().header_body().block_number();
  const transactionBodies = babbageBlock.transaction_bodies();
  const txOutputs = extractTxOutput(transactionBodies as BabbageTransactionBodyList);
  for (const txOutput of txOutputs) {
    if (hasTokenPrefix(txOutput.assets, clientTokenPrefix)) {
      const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
      if (!transactionWitnessSets.redeemers()?.len()) continue;
      const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

      await handleParseClientEvents(txOutput, redeemers, blockHeight);
    }
    if (hasTokenPrefix(txOutput.assets, connectionTokenPrefix)) {
      const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
      if (!transactionWitnessSets.redeemers()?.len()) continue;
      const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

      await handleParseConnectionEvents(txOutput, redeemers, blockHeight);
    }
    if (hasTokenPrefix(txOutput.assets, channelTokenPrefix)) {
      const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
      if (!transactionWitnessSets.redeemers()?.len()) continue;
      const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

      await handleParseChannelEvents(txOutput, redeemers, blockHeight);
    }
  }
}

async function handleParseClientEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint
): Promise<void> {
  try {
    console.log(`handleParseClientEvents starting`);
    const clientDatum = Data.from(txOutput.datum, ClientDatum);
    const latestConsensus = [...clientDatum.state.consensus_states].at(-1);
    const fstRedeemerData = redeemers.get(0).data();

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: EventType.CreateClient,
    });
    const eventAttributes: {key: string; value: string}[] = [
      {
        key: EventAttributeClient.AttributeKeyClientID,
        value: getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CLIENT_PREFIX),
      },
      {
        key: EventAttributeClient.AttributeKeyConsensusHeight,
        value: latestConsensus?.[0].revision_height.toString() ?? '',
      },
      {
        key: EventAttributeClient.AttributeKeyHeader,
        value: '',
      },
    ];

    if (fstRedeemerData.as_constr_plutus_data()?.fields().len() == 0) {
      // for create client
      // const handlerOperatorRedeemerHex = fstRedeemerData.to_cbor_hex();
      // const handlerOperatorRedeemer = Data.from(handlerOperatorRedeemerHex, HandlerOperator);
      event.type = EventType.CreateClient;

      // eventAttributes.push({
      //   key: EventAttributeClient.AttributeKeyHeader,
      //   value: '',
      // });
    } else {
      // for update client
      const spendClientRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendClientRedeemer = Data.from(spendClientRedeemerHex, SpendClientRedeemer);
      event.type = EventType.UpdateClient;

      let header = '';
      if (spendClientRedeemer.valueOf().hasOwnProperty('UpdateClient')) {
        // TODO: get header update client
        // const UpdateClientSchema = Data.Object({UpdateClient: Data.Object({msg: ClientMessageSchema})});
        // type UpdateClientSchema = Data.Static<typeof UpdateClientSchema>;
        // const spendClientRedeemerSchema = spendClientRedeemer.valueOf() as unknown as UpdateClientSchema;
        // const clientMessage = spendClientRedeemerSchema['UpdateClient'].msg.valueOf();
        // if (clientMessage.hasOwnProperty('HeaderCase')) {
        //   const clientMessage
        // }
      }
      // eventAttributes.push({
      //   key: EventAttributeClient.AttributeKeyHeader,
      //   value: header,
      // });
    }

    await event.save();
    for (const attribute of eventAttributes) {
      const index = eventAttributes.indexOf(attribute);
      const eventAttribute = EventAttribute.create({
        id: `${txOutput.hash}-${txOutput.txIndex}-${index}`,
        eventId: event.id,
        key: attribute.key,
        value: attribute.value,
      });
      await eventAttribute.save();
    }
    console.log(`handleParseClientEvents end`);
  } catch (error) {
    console.log('Handle Parse Client Event ERR: ', error);
  }
}

async function handleParseConnectionEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint
): Promise<void> {
  try {
    const connectionDatum = Data.from(txOutput.datum, ConnectionDatum);
    let eventType: EventType = EventType.ConnectionOpenInit;
    // for connection init
    if (connectionDatum.state.state == 'Init') {
      const mintConnectionRedeemerHex = redeemers.get(1).data().to_cbor_hex();
      const mintConnectionRedeemer = Data.from(mintConnectionRedeemerHex, MintConnectionRedeemer);
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenInit')) eventType = EventType.ConnectionOpenInit;
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenTry')) eventType = EventType.ConnectionOpenTry;
    }
    // for connection ack
    if (connectionDatum.state.state == 'Open') {
      const spendConnectionRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendConnectionRedeemer = Data.from(spendConnectionRedeemerHex, SpendConnectionRedeemer);

      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenAck')) eventType = EventType.ConnectionOpenAck;
      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenConfirm'))
        eventType = EventType.ConnectionOpenConfirm;
    }

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
    });
    await event.save();
  } catch (error) {
    console.log('Handle Parse Connection Event ERR: ', error);
  }
}

async function handleParseChannelEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint
): Promise<void> {
  try {
    // case channel init
    const channelDatum = Data.from(txOutput.datum, ChannelDatum);
    let eventType: EventType = EventType.ChannelOpenInit;
    if (channelDatum.state.channel.state == 'Init') {
      const mintChannelRedeemerHex = redeemers.get(2).data().to_cbor_hex();
      const mintChannelRedeemer = Data.from(mintChannelRedeemerHex, MintChannelRedeemer);
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenInit')) eventType = EventType.ChannelOpenInit;
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenTry')) eventType = EventType.ChannelOpenTry;
    }
    // channel ack
    if (channelDatum.state.channel.state == 'Open') {
      const spendChannelRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendChannelRedeemer = Data.from(spendChannelRedeemerHex, SpendChannelRedeemer);
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenAck')) eventType = EventType.ChannelOpenAck;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenConfirm')) eventType = EventType.ChannelOpenConfirm;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('RecvPacket')) eventType = EventType.RecvPacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('TimeoutPacket')) eventType = EventType.TimeoutPacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('AcknowledgePacket')) eventType = EventType.AcknowledgePacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('SendPacket')) eventType = EventType.SendPacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanCloseConfirm')) eventType = EventType.ChannelCloseConfirm;
    }

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
    });
    await event.save();
  } catch (error) {
    console.log('Handle Parse Channel Event ERR: ', error);
  }
}
