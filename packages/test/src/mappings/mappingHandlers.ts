// @ts-nocheck
import {
  AlonzoRedeemerList,
  BabbageBlock,
  MultiEraBlock as CardanoBlock,
  PlutusData,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import * as handler from '../contracts/handler.json';
import {CHANNEL_TOKEN_PREFIX, CLIENT_PREFIX, CONNECTION_TOKEN_PREFIX} from '../constants';
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
import {fromHex} from '@harmoniclabs/uint8array-utils';
import {getIdFromTokenAssets} from '../utils/utxo';

export async function handleCardanoBlock(cborHex: string): Promise<void> {
  // const cborHexTest =
  //   '820685828a1960c41a0001862758202407c6f8bb36749cd84cb3648a4bbc90a59f5f127467b29ced6efb6d04f099a658205a3d778e76741a009e29d23093cfe046131808d34d7c864967b515e98dfc35835820b882007593ef70f86e5c0948561a3b8e8851529a4f98975f2b24e768dda38ce2825840b911ccc76b0b3b21b62750601aa7b1f03fdc300606c9e3895f7f0543bf547cb371e6fe70a938ea92832353e5552e9dc77c31aa54772c71ec9b9260b9dc7b778a58504bf7d27b7bc290af91cb75f0b9c9f7c396a3e4e9d91fd7d6cd3eb9919d40b717ec871ac0dbeb70a0ecb4e34479ebe27bf796ace5ad21947620f3bc898ce650ac8cd98ba4784c020bd05bafa8cf6b5a0304582029571d16f081709b3c48651860077bebf9340abb3fc7133443c54f1f5a5edcf18458204cd49bb05e9885142fe7af1481107995298771fd1a24e72b506a4d600ee2b3120000584089fc9e9f551b2ea873bf31643659d049152d5c8e8de86be4056370bccc5fa62dd12e3f152f1664e614763e46eaa7a17ed366b5cef19958773d1ab96941442e0b8209005901c0be581c6b4d37ce79dbe2681d01b1d5484e6eb1d798c597aa6bb1a32cbcc9cc467c4e279390f0d9a91889bae7021fdca4c0389a9156594d075e4694c24ad5080a13f86ef743a7bba0286db6ddf3d85bf8e49ddbf14d9d3b7ee22f4857c77b740948f84f2e72f6bcf91f405e34ea50a2c53fa4876b43cfce2bcfe87c06a903de8b4dc7d3187f76048fbef9a52b72d80d835bb76eced7c0e0cdc5b58869b73c095dffa01db4ff51765afcead565395a5ed1cf74e5f2134d61076fece21aacd080bb3b92c77b1328ff1b83855da704fc366bf4415490602481d1939136eeaf252c65184912a779d9d94a90e32b72c1877ef60b6d79e707ce5a762acb4bed46436efeb2394c385ec63fcd85ed56eec3de48860a1ec950aad4f91cbf741dbd7bf1d3c278875bd20e31ff5372339f6aa5280ad9b8bf3514889ac44600fe57ca0b535d6d3f53311e21199cccc0b080f28d18f4dc6987731e10e4ade00df7c6921c5ef3022b6f49a29ba307a2c8f4bd2ba42fcfa0aad68a2f0ad31fff69a99d3471f9036dda2bb36c716beae8d706bc648a790d4697e1d044a11a49f305ab8bc64a094bd81bda7395fe6f77dd5557c39919dd9bb9cf22a87fe47408ae3ec2247007d015a58080a080';
  // const cborHexTest =
  //   '820685828a1967371a00019f8a5820cedf5e11604805bdb6c4197b772495d03b6865232695aac6dddd586c386999a058205a3d778e76741a009e29d23093cfe046131808d34d7c864967b515e98dfc35835820b882007593ef70f86e5c0948561a3b8e8851529a4f98975f2b24e768dda38ce2825840932d85a57f714c1f0059cb5a1994509141470c2b25e3491f2e36de7c491cfb7a0023b829807d2d8e41c2cbf62be252a487fbbbff09c3616cf364815dd654bc725850e9acba27a54adccf1d45d8edd12995040a092901ecca7e85622445158def632c990cf55b3175665b2c10c5050555ff9d5d723173c883eb4b67dafc458ac94da0921afc384d1c2cd939697ac86b9c0a08190467582022ac1fddb528cef327788112279f9c757912d564b63d8e5a5be47d32c4cd9c778458204cd49bb05e9885142fe7af1481107995298771fd1a24e72b506a4d600ee2b3120000584089fc9e9f551b2ea873bf31643659d049152d5c8e8de86be4056370bccc5fa62dd12e3f152f1664e614763e46eaa7a17ed366b5cef19958773d1ab96941442e0b8209005901c0497af98029ca81b6dad7d314e932ffaea4905c812da1e68bfa30d763246d0adb31e916a8bf8517a25f42f9efe5bdc2d459bcf9afdf02dc9e5a83516a3e13d90b13f86ef743a7bba0286db6ddf3d85bf8e49ddbf14d9d3b7ee22f4857c77b740948f84f2e72f6bcf91f405e34ea50a2c53fa4876b43cfce2bcfe87c06a903de8b4dc7d3187f76048fbef9a52b72d80d835bb76eced7c0e0cdc5b58869b73c095dffa01db4ff51765afcead565395a5ed1cf74e5f2134d61076fece21aacd080bb3b92c77b1328ff1b83855da704fc366bf4415490602481d1939136eeaf252c65184912a779d9d94a90e32b72c1877ef60b6d79e707ce5a762acb4bed46436efeb2394c385ec63fcd85ed56eec3de48860a1ec950aad4f91cbf741dbd7bf1d3c278875bd20e31ff5372339f6aa5280ad9b8bf3514889ac44600fe57ca0b535d6d3f53311e21199cccc0b080f28d18f4dc6987731e10e4ade00df7c6921c5ef3022b6f49a29ba307a2c8f4bd2ba42fcfa0aad68a2f0ad31fff69a99d3471f9036dda2bb36c716beae8d706bc648a790d4697e1d044a11a49f305ab8bc64a094bd81bda7395fe6f77dd5557c39919dd9bb9cf22a87fe47408ae3ec2247007d015a581aa0082825820e4305904196744e82623c849b32681448d0fcddcbcf46847c413c8ab0cd74a5900825820fefa0f4997058bc7d56237f124c08920f1e4d28e8e291da4aa56bb1b4dcefa22010183a300581d70c3d357b1f80cca70d5ecac0e2cd949342b4f30482681dc62ae5a7f8701821a001430a2a1581c8bc24e12ec136dbff5ccb05380fdaae66089182bde45bfd22be0a67ba14768616e646c657201028201d818583bd8799fd8799f0d0a099f18631864ffffd8799f581c8bc24e12ec136dbff5ccb05380fdaae66089182bde45bfd22be0a67b4768616e646c6572ffffa300581d708e5bbfb1f6a13d19c38e8f9d1b06e34604ed23fe7bd5bd557b33721201821a00253924a1581c13cd4d50ea648ba4572068250c6fa9a24c7284dfdbef6fa066541c6aa1581a14807575bdd0c3aa43547c44f70b3c0552b5cb66f2c9db64313201028201d818590129d8799fd8799fd8799f4973696465636861696ed8799f0103ff1b0005795974ab80001b0006722feb7b00001b0000008bb2c97000d8799f0000ffd8799f001a0004f1caff9fd8799fd8799f010001014100ffd8799f9f0001ff1821040c4001ff0000d87980ffd8799fd8799f010001014100ffd8799f9f0001ff182001014001ff0000d87980ffffffa1d8799f001a0004f1caffd8799f1b17e4cc657380298a582035626aba443a0daf9bc6a6166db0c9749c424f73174a8de02194fdae48189fc7d8799f5820cf477326aeb18360c0c3bc2129da50a27fe5a3de91da268132378b41429cbb50ffffffd8799f581c13cd4d50ea648ba4572068250c6fa9a24c7284dfdbef6fa066541c6a581a14807575bdd0c3aa43547c44f70b3c0552b5cb66f2c9db643132ffff82581d60247570b8ba7dc725e9ff37e9757b8148b4d5a125958edac2fd4417b81b00000006e7c2a36b021a0004aa2d031a0001a0ae09a1581c13cd4d50ea648ba4572068250c6fa9a24c7284dfdbef6fa066541c6aa1581a14807575bdd0c3aa43547c44f70b3c0552b5cb66f2c9db643132010b5820aa6887182a193c0c1fb76c8de2bdfdd3ef106f7894f76efb83abae2ca58cc6010d81825820fefa0f4997058bc7d56237f124c08920f1e4d28e8e291da4aa56bb1b4dcefa22011082581d60247570b8ba7dc725e9ff37e9757b8148b4d5a125958edac2fd4417b81b00000006e7e58778111a0006ff4412828258206f8d8539b2bf224fdaae54ddc71c3fd1afb903ee03f79b3ac628b4ace0217195008258209944a41267a2f631583f29ea6439def7d6a9c9a78429c4807890665fee1199df0081a20081825820f87d667e08d0bfc420ce7f71e1c780b8952b09a4e48af784cea58588a22168fb584017dd2b9d719024b77b4ccfc9f936811c480a15598edd2096de642ade5d2e0867cee1e4b2e6a52587d2ca04875726c880d37c959c7eaecfc52e7fb642519107000582840000d87980821a000515a11a0762b623840100d8799fd8799f581c8bc24e12ec136dbff5ccb05380fdaae66089182bde45bfd22be0a67b4768616e646c6572ffff821a000d40361a129d0b61a080';
  console.log(`Handling an incoming block on Cardano starting`);
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
  console.log('Block height: ', blockHeight);
  console.log('transactionBodies: ', transactionBodies.get(0).to_cbor_hex());

  const outputs: TxOutput[] = extractTxOutput(transactionBodies);
  for (const txOutput of outputs) {
    const isMatchClientTokenPrefix = hasTokenPrefix(txOutput.assets, clientTokenPrefix);
    console.log({
      isMatchClientTokenPrefix,
      clientTokenPrefix,
    });

    if (hasTokenPrefix(txOutput.assets, clientTokenPrefix)) {
      console.log('handle client events');
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
    const clientDatum = decodeCborHex(txOutput.datum, ClientDatum);
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
      // const handlerOperatorRedeemer = decodeCborHex(handlerOperatorRedeemerHex, HandlerOperator);
      event.type = EventType.CreateClient;

      // eventAttributes.push({
      //   key: EventAttributeClient.AttributeKeyHeader,
      //   value: '',
      // });
    } else {
      // for update client
      const spendClientRedeemerHex = redeemers.get(0).data().to_cbor_hex();
      const spendClientRedeemer = decodeCborHex(spendClientRedeemerHex, SpendClientRedeemer);
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

    const channelDatum = decodeCborHex(txOutput.datum, ChannelDatum);
    let eventType: EventType = EventType.ChannelOpenInit;
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
