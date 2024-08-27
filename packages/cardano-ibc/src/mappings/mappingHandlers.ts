// @ts-nocheck
import {
  AlonzoRedeemerList,
  BabbageBlock,
  MultiEraBlock as CardanoBlock,
  CoinSelectionStrategyCIP2,
  PlutusData,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import * as handler from '../contracts/handler.json';
import {CHANNEL_TOKEN_PREFIX, CLIENT_PREFIX, CONNECTION_TOKEN_PREFIX, CHANNEL_ID_PREFIX, CONNECTION_ID_PREFIX, CLIENT_ID_PREFIX} from '../constants';
import {ClientDatum} from '../ibc-types/client/ics_007_tendermint_client/client_datum/ClientDatum';
import {SpendClientRedeemer} from '../ibc-types/client/ics_007_tendermint_client/client_redeemer/SpendClientRedeemer';
import {ConnectionDatum} from '../ibc-types/core/ics_003_connection_semantics/connection_datum/ConnectionDatum';
import {MintConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/MintConnectionRedeemer';
import {SpendConnectionRedeemer} from '../ibc-types/core/ics_003_connection_semantics/connection_redeemer/SpendConnectionRedeemer';
import {ChannelDatum} from '../ibc-types/core/ics_004/channel_datum/ChannelDatum';
import {MintChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/MintChannelRedeemer';
import {SpendChannelRedeemer} from '../ibc-types/core/ics_004/channel_redeemer/SpendChannelRedeemer';
import {Event, Channel, Client, EventAttribute, EventType, CardanoIbcAsset, ChannelStateType, CardanoTransfer, MsgType} from '../types';
import {EventAttributeChannel, EventAttributeConnection, EventAttributeClient} from '../constants/eventAttributes';
import {fromHex} from '@harmoniclabs/uint8array-utils';
import {ClientMessageSchema} from '../ibc-types/client/ics_007_tendermint_client/msgs/ClientMessage';
import {Header, HeaderSchema} from '../ibc-types/client/ics_007_tendermint_client/header/Header';
import {Data} from '../ibc-types/plutus/data';
import { convertHex2String, convertString2Hex, hexToBytes } from '../utils/hex';
import { getDenomPrefix } from '../utils/helper';
import { Connection } from '../types/models';

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
  const slot = babbageBlock.header().header_body().slot();
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

      await handleParseChannelEvents(txOutput, redeemers, blockHeight, slot);
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
    const proofSpecs = clientDatum.state.client_state.proof_specs.map((proof) => ({
      leafSpec: {
        hash: proof.leaf_spec.hash,
        prehashKey: proof.leaf_spec.prehash_key,
        prehashValue: proof.leaf_spec.prehash_value,
        length: proof.leaf_spec.length,
        prefix: proof.leaf_spec.prefix,
      },
      innerSpec: {  
        childOrder: proof.inner_spec.child_order,
        childSize: proof.inner_spec.child_size,
        minPrefixLength: proof.inner_spec.min_prefix_length,
        maxPrefixLength: proof.inner_spec.max_prefix_length,
        emptyChild: proof.inner_spec.empty_child,
        hash: proof.inner_spec.hash,
      },
      maxDepth: proof.max_depth,
      minDepth: proof.min_depth,
      prehashKeyBeforeComparison: proof.prehash_key_before_comparison,
    }))

    const clientSequence = getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CLIENT_PREFIX)
    const client = Client.create({
      id: `${CLIENT_ID_PREFIX}-${clientSequence}`,
      chainId: convertHex2String(clientDatum.state.client_state.chain_id),
      trustLevel: {
        numerator: clientDatum.state.client_state.trust_level.numerator,
        denominator: clientDatum.state.client_state.trust_level.denominator,
      },
      trustingPeriod: clientDatum.state.client_state.trusting_period,
      unbondingPeriod: clientDatum.state.client_state.unbonding_period,
      maxClockDrift: clientDatum.state.client_state.max_clock_drift,
      frozenHeight: {
        revisionNumber: clientDatum.state.client_state.frozen_height.revision_number,
        revisionHeight: clientDatum.state.client_state.frozen_height.revision_height
      },
      latestHeight: {
        revisionNumber: clientDatum.state.client_state.latest_height.revision_number,
        revisionHeight: clientDatum.state.client_state.latest_height.revision_height,
      },
      proofSpecs: proofSpecs,
    })
    await client.save();
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
    let eventAttributes: EventAttribute[] = [];
    // for connection init
    const connectionId = getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CONNECTION_TOKEN_PREFIX)
    if (connectionDatum.state.state == 'Init') {
      const mintConnectionRedeemerHex = redeemers.get(1).data().to_cbor_hex();
      const mintConnectionRedeemer = decodeCborHex(mintConnectionRedeemerHex, MintConnectionRedeemer);
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenInit')) {
        eventType = EventType.ConnectionOpenInit;
        logger.info("caseConnOpenInit")
        eventAttributes = extractConnectionEventAttributes(connectionDatum, connectionId)
      }
      if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenTry')) {
        eventType = EventType.ConnectionOpenTry;
        eventAttributes = extractConnectionEventAttributes(connectionDatum, connectionId)
      }
    }
    // for connection ack
    if (connectionDatum.state.state == 'Open') {
      const spendConnectionRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendConnectionRedeemer = decodeCborHex(spendConnectionRedeemerHex, SpendConnectionRedeemer);

      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenAck')) {
        eventType = EventType.ConnectionOpenAck;
        eventAttributes = extractConnectionEventAttributes(connectionDatum, connectionId)
      }
      if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenConfirm')) {
        eventType = EventType.ConnectionOpenConfirm;
        eventAttributes = extractConnectionEventAttributes(connectionDatum, connectionId)
      }
    }
    await saveConnection(eventType, connectionDatum, eventAttributes)

    const event = Event.create({
      id: `${txOutput.hash}-${txOutput.txIndex}`,
      blockHeight: blockHeight,
      txHash: txOutput.hash,
      type: eventType,
      eventAttributes: eventAttributes
    });
    await event.save();
  } catch (error) {
    logger.info('Handle Parse Connection Event ERR: ', error);
  }
}

async function handleParseChannelEvents(
  txOutput: TxOutput,
  redeemers: AlonzoRedeemerList,
  blockHeight: bigint,
  slot: bigint,
): Promise<void> {
  try {
    // case channel init

    const channelDatum = decodeCborHex(txOutput.datum, ChannelDatum);
    let eventType: EventType = EventType.ChannelOpenInit;
    let eventAttributes: EventAttribute[] = [];
    const currentChannelId = getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CHANNEL_TOKEN_PREFIX);
    if (channelDatum.state.channel.state == 'Init') {
      const mintChannelRedeemerHex = redeemers.get(2).data().to_cbor_hex();
      const mintChannelRedeemer = decodeCborHex(mintChannelRedeemerHex, MintChannelRedeemer);
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenInit')) {
        eventType = EventType.ChannelOpenInit;
        eventAttributes = extractChannelEventAttributes(channelDatum, currentChannelId)
        await saveChannel(eventType, eventAttributes, channelDatum)
      }
      if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenTry')) {
        eventType = EventType.ChannelOpenTry;
        eventAttributes = extractChannelEventAttributes(channelDatum, currentChannelId)
        await saveChannel(eventType, eventAttributes, channelDatum)
      }
    }
    // channel ack
    if (channelDatum.state.channel.state == 'Open') {
      const spendChannelRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendChannelRedeemer = decodeCborHex(spendChannelRedeemerHex, SpendChannelRedeemer);
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenAck')){
        eventType = EventType.ChannelOpenAck;
        eventAttributes = extractChannelEventAttributes(channelDatum, currentChannelId)
        await saveChannel(eventType, eventAttributes, channelDatum)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenConfirm')) {
        eventType = EventType.ChannelOpenConfirm;
        eventAttributes = extractChannelEventAttributes(channelDatum, currentChannelId)
        await saveChannel(eventType, eventAttributes, channelDatum)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanCloseConfirm')) {
        eventType = EventType.ChannelCloseConfirm;
        eventAttributes = extractChannelEventAttributes(channelDatum, currentChannelId)
        await saveChannel(eventType, eventAttributes, channelDatum)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('RecvPacket')) {
        eventType = EventType.RecvPacket;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
        await saveCardanoIBCAssets(eventType, eventAttributes)
        await saveCardanoTransfers(eventType, txOutput.hash, blockHeight, slot, eventAttributes)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('TimeoutPacket')) {
        eventType = EventType.TimeoutPacket;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('AcknowledgePacket')){
        eventType = EventType.AcknowledgePacket;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
        await saveCardanoTransfers(eventType, txOutput.hash, blockHeight, slot, eventAttributes)
      }
      if (spendChannelRedeemer.valueOf().hasOwnProperty('SendPacket')) {
        eventType = EventType.SendPacket ;
        eventAttributes = extractPacketEventAttributes(channelDatum, spendChannelRedeemer)
        await saveCardanoTransfers(eventType, txOutput.hash, blockHeight, slot, eventAttributes)
      }
      if (eventType == EventType.ChannelOpenInit) return
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

function extractConnectionEventAttributes(connDatum: ConnectionDatum, connectionId: string): EventAttribute[] {
  return [
    {
      key: EventAttributeConnection.AttributeKeyConnectionID,
      value: `${CONNECTION_ID_PREFIX}-${connectionId}`,
    },
    {
      key: EventAttributeConnection.AttributeKeyClientID,
      value: convertHex2String(connDatum.state.client_id),
    },
    {
      key: EventAttributeConnection.AttributeKeyCounterpartyClientID,
      value: convertHex2String(connDatum.state.counterparty.client_id),
    },
    {
      key: EventAttributeConnection.AttributeKeyCounterpartyConnectionID,
      value: convertHex2String(connDatum.state.counterparty.connection_id),
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

function extractChannelEventAttributes(channelDatum: ChannelDatum, channelId: string): EventAttribute[] {
  const connectionId = Buffer.from(hexToBytes(channelDatum.state.channel.connection_hops[0])).toString();
  return [
    {
      key: EventAttributeChannel.AttributeKeyConnectionID,
      value: connectionId,
    },
    {
      key: EventAttributeChannel.AttributeKeyPortID,
      value: convertHex2String(channelDatum.port_id),
    },
    {
      key: EventAttributeChannel.AttributeKeyChannelID,
      value: `${CHANNEL_ID_PREFIX}-${channelId}`,
    },
    {
      key: EventAttributeChannel.AttributeVersion,
      value: convertHex2String(channelDatum.state.channel.version),
    },
    {
      key: EventAttributeChannel.AttributeCounterpartyChannelID,
      value: convertHex2String(channelDatum.state.channel.counterparty.channel_id),
    },
    {
      key: EventAttributeChannel.AttributeCounterpartyPortID,
      value: convertHex2String(channelDatum.state.channel.counterparty.port_id),
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
  let packetData: Packet;
  let acknowledgement = '';
  if (channelRedeemer.hasOwnProperty('RecvPacket'))
    packetData = channelRedeemer['RecvPacket']?.packet as unknown;
  if (channelRedeemer.hasOwnProperty('SendPacket'))
    packetData = channelRedeemer['SendPacket']?.packet as unknown;
  if (channelRedeemer.hasOwnProperty('AcknowledgePacket')) {
    packetData = channelRedeemer['AcknowledgePacket']?.packet as unknown;
    acknowledgement = channelRedeemer['AcknowledgePacket']?.acknowledgement;
  }
  if (channelRedeemer.hasOwnProperty('TimeoutPacket'))
    packetData = channelRedeemer['TimeoutPacket']?.packet as unknown;
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
      value: `${packetData.timeout_height.revision_number}-${packetData.timeout_height.revision_height}`,
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
  let map = new Map<string, string>();

  eventAttribute.forEach(item => {
    map.set(item.key, item.value)
  })
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
        const prefixDenom = convertString2Hex(voucherTokenRecvPrefix + denomRecv)
        const voucherTokenName = hashSha3_256(prefixDenom);
        const voucherTokenUnit = handler.validators.mintVoucher.scriptHash + voucherTokenName;
        const cardanoIbcAsset = await store.get(`CardanoIbcAsset`, `${voucherTokenUnit}`)
        if(!cardanoIbcAsset) {
          const denomPath = getPathTrace(
            map.get(EventAttributeChannel.AttributeKeyDstPort), 
            map.get(EventAttributeChannel.AttributeKeyDstChannel), 
            packetDataObject?.denom,
          )
          const denomBase = getDenomBase(packetDataObject?.denom)

          const newAsset = CardanoIbcAsset.create({
            id: voucherTokenUnit,
            accountAddress: packetDataObject?.receiver,
            denom: denomBase,
            voucherTokenName: voucherTokenName,
            connectionId: map.get(EventAttributeChannel.AttributeKeyConnection),
            srcPort: map.get(EventAttributeChannel.AttributeKeySrcPort),
            srcChannel: map.get(EventAttributeChannel.AttributeKeySrcChannel),
            dstPort: map.get(EventAttributeChannel.AttributeKeyDstPort),
            dstChannel: map.get(EventAttributeChannel.AttributeKeyDstChannel),
            path: denomPath
          })
          await newAsset.save();
        }
      }
  }
}

async function saveChannel(eventType: EventType, eventAttribute: EventAttribute[], channelDatum: ChannelDatum) {
  let map = new Map<string, string>();

  eventAttribute.forEach(item => {
    map.set(item.key, item.value)
  })

  let channel = Channel.create({
    id: map.get(EventAttributeChannel.AttributeKeyChannelID),
    state: ChannelStateType.Uninitialized,
    ordering: channelDatum.state.channel.ordering,
    portId: map.get(EventAttributeChannel.AttributeKeyPortID),
    counterparty: {
      portId: map.get(EventAttributeChannel.AttributeCounterpartyPortID),
      channel: map.get(EventAttributeChannel.AttributeCounterpartyChannelID)
    },
    connectionHops: map.get(EventAttributeChannel.AttributeKeyConnectionID),
    version: map.get(EventAttributeChannel.AttributeVersion)
  })

  if(eventType == EventType.ChannelOpenInit) {
    channel.state = ChannelStateType.Init
  }
  if(eventType == EventType.ChannelOpenTry) {
    channel.state = ChannelStateType.TryOpen
  }
  if(eventType == EventType.ChannelOpenAck) {
    channel.state = ChannelStateType.Open
  }
  if(eventType == EventType.ChannelOpenConfirm) {
    channel.state = ChannelStateType.Open
  }
  if(eventType == EventType.ChannelCloseInit) {
    channel.state = ChannelStateType.Closed
  }
  if(eventType == EventType.ChannelCloseConfirm) {
    channel.state = ChannelStateType.Closed
  }
  await channel.save();
}

async function saveConnection(eventType: EventType, connDatum: ConnectionDatum, eventAttribute: EventAttribute[]) {
  let map = new Map<string, string>();

  eventAttribute.forEach(item => {
    map.set(item.key, item.value)
  })

  const versions = connDatum.state.versions.map((version) => ({
    identifier: convertHex2String(version.identifier),
    features: version.features.map((features) => convertHex2String(features))
  }))
  
  let connection = Connection.create({
    id: map.get(EventAttributeConnection.AttributeKeyConnectionID),
    clientId: map.get(EventAttributeConnection.AttributeKeyClientID),
    state: connDatum.state.state,
    versions: versions,
    counterparty: {
      clientId: map.get(EventAttributeConnection.AttributeKeyCounterpartyClientID),
      connectionId: map.get(EventAttributeConnection.AttributeKeyCounterpartyConnectionID),
      prefix: connDatum.state.counterparty.prefix
    },
    delayPeriod: connDatum.state.delay_period
  })

  await connection.save();
}

async function saveCardanoTransfers(eventType: EventType, txHash: String, blockHeight: BigInt, slot: BigInt, eventAttribute: EventAttribute[]) {
  let map = new Map<string, string>();

  eventAttribute.forEach(item => {
    map.set(item.key, item.value)
  })
  const packetData = map.get(EventAttributeChannel.AttributeKeyData)
  const packetDataObject = JSON.parse(packetData)

  let newCardanoTransfer = CardanoTransfer.create({
    id: txHash,
    blockHeight: blockHeight,
    slot: slot,
    sender: packetDataObject?.sender,
    receiver: packetDataObject?.receiver,
    sequence: map.get(EventAttributeChannel.AttributeKeySequence),
    srcPort: map.get(EventAttributeChannel.AttributeKeySrcPort),
    srcChannel: map.get(EventAttributeChannel.AttributeKeySrcChannel),
    dstPort: map.get(EventAttributeChannel.AttributeKeyDstPort),
    dstChannel: map.get(EventAttributeChannel.AttributeKeyDstChannel),
    connectionId: map.get(EventAttributeChannel.AttributeKeyConnection),
    msgType: MsgType.SendPacket,
    amount: packetDataObject?.amount,
    denom: packetDataObject?.denom,
  })

  if(eventType == EventType.RecvPacket) {
    newCardanoTransfer.msgType = MsgType.RecvPacket
  }
  if(eventType == EventType.AcknowledgePacket) {
    newCardanoTransfer.msgType = MsgType.AcknowledgePacket
  }

  await newCardanoTransfer.save()
}

function getDenomBase(denom: string): string {
  const steps = denom.split("/")
  return steps.pop()
}
function getPathTrace(port: string, channel: string, denom: string): string {
  const steps = denom.split("/")
  const denomBase = steps.pop()
  if(steps.length %2 != 0) {
    return ""
  }
  const resDenom = denom.slice(0, denom.length - denomBase?.length);
  if(resDenom.length == 0) {
    return `${port}/${channel}`
  } else {
    let res = `${port}/${channel}/${resDenom}`
    if(res.endsWith("/")) {
      res = res.slice(0,-1)
    }
    return res
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
