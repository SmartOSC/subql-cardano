// @ts-nocheck
import {
  AlonzoRedeemerList,
  BabbageBlock,
  MultiEraBlock as CardanoBlock,
  PlutusData,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import * as handler from '../contracts/handler.json';
import {CHANNEL_TOKEN_PREFIX, CLIENT_PREFIX, CONNECTION_TOKEN_PREFIX, CHANNEL_ID_PREFIX} from '../constants';
import {ClientDatum} from '../ibc-types/client/ics_007_tendermint_client/client_datum/ClientDatum';
import {SpendClientRedeemer} from '../ibc-types/client/ics_007_tendermint_client/client_redeemer/SpendClientRedeemer';
import {ConnectionDatum} from '../ibc-types/core/ics_003_connection_semantics/connection_datum/ConnectionDatum';
import {MintConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/MintConnectionRedeemer';
import {SpendConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/SpendConnectionRedeemer';
import {ChannelDatum} from '../ibc-types/core/ics_004/channel_datum/ChannelDatum';
import {MintChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/MintChannelRedeemer';
import {SpendChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/SpendChannelRedeemer';
import {Event, EventAttribute, EventType, CardanoIbcAsset } from '../types';
import {EventAttributeChannel, EventAttributeClient} from '../constants/eventAttributes';
import {fromHex} from '@harmoniclabs/uint8array-utils';
import {ClientMessageSchema} from '../ibc-types/client/ics_007_tendermint_client/msgs/ClientMessage';
import {Header, HeaderSchema} from '../ibc-types/client/ics_007_tendermint_client/header/Header';
import {Data} from '../ibc-types/plutus/data';
import { convertHex2String } from '../utils/hex';
import { getDenomPrefix } from '../helpers/helper';

export async function handleCardanoBlock(cborHex: string): Promise<void> {
  logger.info(`Handling an incoming block on Cardano starting`);
  const handlerAuthToken = handler.handlerAuthToken;
  const clientTokenPrefix = generateTokenName(handlerAuthToken, CLIENT_PREFIX, '');
  const connectionTokenPrefix = generateTokenName(handlerAuthToken, CONNECTION_TOKEN_PREFIX, '');
  const channelTokenPrefix = generateTokenName(handlerAuthToken, CHANNEL_TOKEN_PREFIX, '');

  const block = from_explicit_network_cbor_bytes(fromHex(cborHex)) as CardanoBlock;
  // const block = getMultiEraBlockFromCborHex(cborHex) as CardanoBlock;
  if (!block.as_babbage()) {
    console.error(`Handling an incoming block error: Block is not babbage`);
    return;
  }

  const babbageBlock = block.as_babbage() as BabbageBlock;
  const blockHeight = babbageBlock.header().header_body().block_number();
  const transactionBodies = babbageBlock.transaction_bodies();
  if (!transactionBodies.len()) {
    logger.info(`Block Height ${blockHeight} hasn't transaction`);
    return;
  }

  const outputs: TxOutput[] = extractTxOutput(transactionBodies);
  for (const txOutput of outputs) {
    const isMatchClientTokenPrefix = hasTokenPrefix(txOutput.assets, clientTokenPrefix);
    logger.info({
      isMatchClientTokenPrefix,
      clientTokenPrefix,
    });

    if (hasTokenPrefix(txOutput.assets, clientTokenPrefix)) {
      logger.info('handle client events');
      const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
      if (!transactionWitnessSets.redeemers()?.len()) continue;
      const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

      await handleParseClientEvents(txOutput, redeemers, blockHeight);
    }
    if (hasTokenPrefix(txOutput.assets, connectionTokenPrefix)) {
      logger.info('handle connection events');
      const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
      if (!transactionWitnessSets.redeemers()?.len()) continue;
      const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

      await handleParseConnectionEvents(txOutput, redeemers, blockHeight);
    }
    if (hasTokenPrefix(txOutput.assets, channelTokenPrefix)) {
      logger.info('handle channel events');
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
    logger.info(`handleParseClientEvents starting`);
    const clientDatum = decodeCborHex(txOutput.datum, ClientDatum);
    const latestConsensus = [...clientDatum.state.consensus_states].at(-1);
    const fstRedeemerData = redeemers.get(0).data();

    const eventAttributes: EventAttribute[] = [
      {
        key: EventAttributeClient.AttributeKeyClientID,
        value: getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CLIENT_PREFIX),
      },
      {
        key: EventAttributeClient.AttributeKeyConsensusHeight,
        value: latestConsensus?.[0].revision_height.toString() ?? '',
      },
    ];
    let eventType: EventType = EventType.ChannelOpenInit;
    let header = '';
    if (fstRedeemerData.as_constr_plutus_data()?.fields().len() == 0) {
      logger.info('create client');
      // for create client
      // const handlerOperatorRedeemerHex = fstRedeemerData.to_cbor_hex();
      // const handlerOperatorRedeemer = decodeCborHex(handlerOperatorRedeemerHex, HandlerOperator);
      eventType = EventType.CreateClient;
    } else {
      logger.info('update client');
      // for update client
      const spendClientRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendClientRedeemer = decodeCborHex(spendClientRedeemerHex, SpendClientRedeemer);
      eventType = EventType.UpdateClient;

      if (spendClientRedeemer.valueOf().hasOwnProperty('UpdateClient')) {
        // TODO: get header update client
        const UpdateClientSchema = Data.Object({UpdateClient: Data.Object({msg: ClientMessageSchema})});
        type UpdateClientSchema = Data.Static<typeof UpdateClientSchema>;
        const HeaderCaseSchema = Data.Object({HeaderCase: Data.Tuple([HeaderSchema])});
        type HeaderCaseSchema = Data.Static<typeof HeaderCaseSchema>;
        const spendClientRedeemerSchema = spendClientRedeemer.valueOf() as unknown as UpdateClientSchema;
        const clientMessage = spendClientRedeemerSchema['UpdateClient'].msg.valueOf() as unknown as HeaderCaseSchema;
        if (clientMessage.hasOwnProperty('HeaderCase')) {
          const headerMessage = clientMessage['HeaderCase'].valueOf()[0] as unknown as Header;
          header = encodeCborObj(headerMessage, Header);
        }
      }
    }

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
      eventAttributes: [
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
          value: header,
        },
      ],
    });
    await event.save();
    logger.info(`handleParseClientEvents end`);
  } catch (error) {
    logger.info('Handle Parse Client Event ERR: ', error);
  }
}

async function handleParseConnectionEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint
): Promise<void> {
  try {
    const connectionDatum = decodeCborHex(txOutput.datum, ConnectionDatum);
    let eventType: EventType = EventType.ConnectionOpenInit;
    // for connection init
    if (connectionDatum.state.state == 'Init') {
      const mintConnectionRedeemerHex = redeemers.get(1).data().to_cbor_hex();
      const mintConnectionRedeemer = decodeCborHex(mintConnectionRedeemerHex, MintConnectionRedeemer);
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenInit')) eventType = EventType.ConnectionOpenInit;
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenTry')) eventType = EventType.ConnectionOpenTry;
    }
    // for connection ack
    if (connectionDatum.state.state == 'Open') {
      const spendConnectionRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendConnectionRedeemer = decodeCborHex(spendConnectionRedeemerHex, SpendConnectionRedeemer);

      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenAck')) eventType = EventType.ConnectionOpenAck;
      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenConfirm'))
        eventType = EventType.ConnectionOpenConfirm;
    }

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
      eventAttributes: [
        {
          key: 'connection',
          value: 'test',
        },
      ],
    });
    await event.save();
  } catch (error) {
    logger.info('Handle Parse Connection Event ERR: ', error);
  }
}

async function handleParseChannelEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint
): Promise<void> {
  try {
    // case channel init

    const channelDatum = decodeCborHex(txOutput.datum, ChannelDatum);
    let eventType: EventType = EventType.ChannelOpenInit;
    let eventAttributes: EventAttribute[] = [];
    if (channelDatum.state.channel.state == 'Init') {
      const mintChannelRedeemerHex = redeemers.get(2).data().to_cbor_hex();
      const mintChannelRedeemer = decodeCborHex(mintChannelRedeemerHex, MintChannelRedeemer);
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenInit')) eventType = EventType.ChannelOpenInit;
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenTry')) eventType = EventType.ChannelOpenTry;
    }
    // channel ack
    if (channelDatum.state.channel.state == 'Open') {
      const spendChannelRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendChannelRedeemer = decodeCborHex(spendChannelRedeemerHex, SpendChannelRedeemer);
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenAck')) eventType = EventType.ChannelOpenAck;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenConfirm')) eventType = EventType.ChannelOpenConfirm;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanCloseConfirm')) eventType = EventType.ChannelCloseConfirm;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('RecvPacket')) {
        eventType = EventType.RecvPacket;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
        await saveCardanoIBCAssets(eventType,eventAttributes)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('TimeoutPacket')) eventType = EventType.TimeoutPacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('AcknowledgePacket')) eventType = EventType.AcknowledgePacket;
      if (spendChannelRedeemer.valueOf().hasOwnProperty('SendPacket')) {
        eventType = EventType.SendPacket ;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
      }
    }

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
      eventAttributes: eventAttributes,
    });
    await event.save();
  } catch (error) {
    logger.info('Handle Parse Channel Event ERR: ', error);
  }
}

// function extractClientEventAttributes(): EventAttribute[] {}

// function extractConnectionEventAttributes(): EventAttribute[] {}

function extractChannelEventAttributes(channelDatum: ChannelDatum): EventAttribute[] {
  return [
    {
      key: EventAttributeChannel.AttributeKeyConnectionID,
      value: connectionId,
    },
    {
      key: EventAttributeChannel.AttributeKeyPortID,
      value: convertHex2String(chanDatum.port),
    },
    {
      key: EventAttributeChannel.AttributeKeyChannelID,
      value: `${CHANNEL_ID_PREFIX}-${channelId}`,
    },
    {
      key: EventAttributeChannel.AttributeVersion,
      value: convertHex2String(chanDatum.state.channel.version),
    },
    {
      key: EventAttributeChannel.AttributeCounterpartyChannelID,
      value: convertHex2String(chanDatum.state.channel.counterparty.channel_id),
    },
    {
      key: EventAttributeChannel.AttributeCounterpartyPortID,
      value: convertHex2String(chanDatum.state.channel.counterparty.port_id),
    },
  ].map(
    (attr) =>
      <EventAttribute>{
        key: attr.key.toString(),
        value: attr.value.toString(),
        index: true,
      },
  )
}

function extractPacketEventAttributes(channelDatum: ChannelDatum, channelRedeemer: SpendChannelRedeemer): EventAttribute[] {
  logger.info("extractPacketEventAttributes")
  let packetData: Packet;
  let acknowledgement = '';
  if (channelRedeemer.hasOwnProperty('RecvPacket'))
    packetData = channelRedeemer['RecvPacket']?.packet as unknown as Packet;
  if (channelRedeemer.hasOwnProperty('SendPacket'))
    packetData = channelRedeemer['SendPacket']?.packet as unknown as Packet;
  if (channelRedeemer.hasOwnProperty('AcknowledgePacket')) {
    packetData = channelRedeemer['AcknowledgePacket']?.packet as unknown as Packet;
    acknowledgement = channelRedeemer['AcknowledgePacket']?.acknowledgement;
  }
  if (channelRedeemer.hasOwnProperty('TimeoutPacket'))
    packetData = channelRedeemer['TimeoutPacket']?.packet as unknown as Packet;
  return [
    {
      key:  EventAttributeChannel.AttributeKeyData,
      value: convertHex2String(packetData.data)
    }, 
    {
      key: EventAttributeChannel.AttributeKeyAck,
      value: acknowledgement,
    },
    {
      key: EventAttributeChannel.AttributeKeyDataHex,
      value: packetData.data,
    },
    {
      key: EventAttributeChannel.AttributeKeyAckHex,
      value: acknowledgement,
    },
    {
      key: EventAttributeChannel.AttributeKeyTimeoutHeight,
      value: `${packetData.timeout_height.revisionNumber}-${packetData.timeout_height.revisionHeight}`,
    },
    {
      key: EventAttributeChannel.AttributeKeyTimeoutTimestamp,
      value: packetData.timeout_timestamp,
    },
    {
      key: EventAttributeChannel.AttributeKeySequence,
      value: packetData.sequence,
    },
    {
      key: EventAttributeChannel.AttributeKeySrcPort,
      value: convertHex2String(packetData.source_port),
    },
    {
      key: EventAttributeChannel.AttributeKeySrcChannel,
      value: convertHex2String(packetData.source_channel),
    },
    {
      key: EventAttributeChannel.AttributeKeyDstPort,
      value: convertHex2String(packetData.destination_port)
    },
    {
      key: EventAttributeChannel.AttributeKeyDstChannel,
      value: convertHex2String(packetData.destination_channel),
    },
    {
      key: EventAttributeChannel.AttributeKeyChannelOrdering,
      value: channelDatum.state.channel.ordering,
    },
    {
      key: EventAttributeChannel.AttributeKeyConnection,
      value: convertHex2String(channelDatum.state.channel.connection_hops[0]),
    },
  ].map(
    (attr) => 
      <EventAttribute> {
        key: attr.key.toString(),
        value: attr.value.toString(),
        index: true,
      }
  )
}

async function saveCardanoIBCAssets(eventType: EventType, eventAttribute: EventAttribute[]) {
  logger.info("saveCardanoAssets")
  let map = new Map<string, string>();

  eventAttribute.forEach(item => {
    map.set(item.key, item.value)
  })
  // TODO: check has packet data
  const packetData = map.get(EventAttributeChannel.AttributeKeyData)
  const packetDataObject = JSON.parse(packetData)
  switch(eventType) {
    case EventType.RecvPacket:
      const denomRecv = packetDataObject?.denom
      const voucherTokenRecvPrefix = getDenomPrefix(
        map.get(EventAttributeChannel.AttributeKeyDstPort),
        map.get(EventAttributeChannel.AttributeKeyDstChannel)
      )
      // check case mint
      if(!denomRecv.startsWith(voucherTokenRecvPrefix)) {
        logger.info("case mint")
        logger.info("voucherTokenRecvPrefix " + voucherTokenRecvPrefix)
        logger.info("denom " + denomRecv)
        const prefixDenom = convertString2Hex(voucherTokenRecvPrefix + denomRecv)
        logger.info("prefixDenom "  + prefixDenom)
        const voucherTokenName = hashSha3_256(prefixDenom);
        //const voucherTokenUnit = handler.validators.mintVoucher.scriptHash + voucherTokenName;
        logger.info("voucherTokenName " + voucherTokenName)
        // find by voucherTokenName 
        
        logger.info("hehe")

        const eventExample = await store.getByField(`Event`,`BlockHeight`,26673)
        // const eventExample = await Event.getByFields([["BlockHeight","=",26673]])
        // logger.info("eventExample ", eventExample)
        const cardanoIbcAsset = await CardanoIbcAsset.getByFields([["VoucherTokenName","=",`${voucherTokenName}`]]);
        // const cardanoIbcAsset = await store.getByField("CardanoIbcAsset","VoucherTokenName",voucherTokenName)
        logger.info("cardanoIbcAsset " + cardanoIbcAsset)
        if(cardanoIbcAsset) {
          // update record
          cardanoIbcAsset.amount = cardanoIbcAsset.amount + packetDataObject?.amount;
          await cardanoIbcAsset.save()
        } else {
          // create new record
          const newAsset = CardanoIbcAsset.create({
            id: "id",
            accountAddress: packetDataObject?.receiver,
            denom: packetDataObject?.denom,
            amount: packetDataObject?.amount,
            isIbcToken: true,
            voucherTokenName: voucherTokenName,
            connectionId: map.get(EventAttributeChannel.AttributeKeyConnection),
            port: map.get(EventAttributeChannel.AttributeKeyDstPort),
            channelId: map.get(EventAttributeChannel.AttributeKeyDstChannel),
            chainId: "chain-test",
          })
          await newAsset.save();
        }
        logger.info("end case recv")
      }
    case EventType.SendPacket:
      const denomSend = packetDataObject?.denom
      const voucherTokenSendPrefix = getDenomPrefix(
        map.get(EventAttributeChannel.AttributeKeySrcPort),
        map.get(EventAttributeChannel.AttributeKeySrcChannel)
      )

      if(denomSend.startsWith(voucherTokenSendPrefix)) {
        const prefixDenom = convertString2Hex(voucherTokenSendPrefix + denomSend)
        const voucherTokenName = hashSha3_256(prefixDenom);

        // find by voucherTokenName 
        const cardanoIbcAsset = await CardanoIbcAsset.getByFields([["voucherTokenName","=",voucherTokenName]]);
        if(cardanoIbcAsset) {
          // update record
          cardanoIbcAsset.amount = cardanoIbcAsset.amount - packetDataObject?.amount;
          await cardanoIbcAsset.save()
        } else {
          // create new record
          const newAsset = CardanoIbcAsset.create({
            id: "id",
            accountAddress: packetDataObject?.receiver,
            denom: 0 - packetDataObject?.denom,
            amount: packetDataObject?.amount,
            isIbcToken: true,
            voucherTokenName: voucherTokenName,
            connectionId: map.get(EventAttributeChannel.AttributeKeyConnection),
            port: map.get(EventAttributeChannel.AttributeKeyDstPort),
            channelId: map.get(EventAttributeChannel.AttributeKeyDstChannel),
            chainId: "chain-test",
          })
          await newAsset.save();
        }
      }
  }
}


// utxo.ts
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
    assets: Map<string, TokenAsset[]>
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
