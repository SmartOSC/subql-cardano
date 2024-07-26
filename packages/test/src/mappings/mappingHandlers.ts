import {
  AlonzoRedeemerList,
  BabbageBlock,
  BabbageTransactionBodyList,
  MultiEraBlock as CardanoBlock,
} from '@dcspark/cardano-multiplatform-multiera-lib-nodejs';
import * as handler from '../contracts/handler.json';
import {generateTokenName} from '../utils/utils';
import {CHANNEL_TOKEN_PREFIX, CLIENT_PREFIX, CONNECTION_TOKEN_PREFIX} from '../constants';
// import {TxOutput, extractTxOutput, getIdFromTokenAssets, hasTokenPrefix} from '../utils/utxo';
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
import {fromHex} from '@harmoniclabs/uint8array-utils';

const handlerAuthToken = handler.handlerAuthToken;

export async function handleCardanoBlock(block: CardanoBlock): Promise<void> {
  try {
    console.log(`Handling an incoming block on Cardano starting`);
    // const clientTokenPrefix = generateTokenName(handlerAuthToken, CLIENT_PREFIX, '');
    // const connectionTokenPrefix = generateTokenName(handlerAuthToken, CONNECTION_TOKEN_PREFIX, '');
    // const channelTokenPrefix = generateTokenName(handlerAuthToken, CHANNEL_TOKEN_PREFIX, '');

    const event = Event.create({
      id: `asdas`,
      blockHeight: BigInt(100),
      txHash: 'txOutput.hash',
      type: EventType.CreateClient,
    });
    debugger;
    await event.save();
    console.log(`Handling an incoming block on Cardano end`);
    if (!block) {
      console.error(`Handling an incoming block error: Block is empty`);
      return;
    }

    if (!block.as_babbage()) {
      console.error(`Handling an incoming block error: Block is not babbage`);
      return;
    }

    const cborHex =
      '85828a1a00a11c241a07b248905820f2f91547f5b9d928156a6e9d7dd008e34f8018dd65f58d90c840217c66ed2e095820e579c6217f5b48cd21e14ff683f02ec88a8bda41828e3b597e390922bbfd28d3582083440f4c924a07f444a66b7bec5cf5ea3122a9b8950ac635ebbe23d16ef89f79825840e06a740b7ceb4a6a3aeea2760b55c5ecb708eb77f37697cebfc6355a83078b09add69ac68f267f77098aa3939f586fe6566760e2ce6a84fcedc46bde9361c7fa58505ce808851698187c57cb07dec0b382e1d0b565fa7185bf66b064dcb417796d26517ec0de32b68d189b79abf8d0e96b398b5730ea17048e66871e111579410467b3dba38d6d3ef8516891819917c10e00190a8d582005991eeb467c9672632b77b34e2f50de0b3e3696927409b7fd5f2ce971000486845820af93401ff0bc90631de890df4f4b5ec26ff0d9574cf68ae467dec2029380aeeb171903c558403ba8347f0b1aaeda7745591024f1b79ad1af1c0f1683451c020b0bab7c39df644df440ba0948861271b617ad5e01568b71dda2ac064fefd3151580616e6d15068208005901c05570ca4536202c28c60fd58feefddfb256f8c4467382657aaad811c1d7fa0729697365bf9cd2b9330ea76e984f281082ee1d99292eee404e9ce205db9efabe06d1573287bae9088deb03cc494fa34b1bdb9fa1ab60ed8c243e633b68d7f2bff60f19382805567e410945a9b342fc20980ba69b59fa5075bf3d0ce497cb17c2bb2eddbf996e48851326294dd1e50475c5ab2125af7f2cf92f1f96603ce36da3948f9e4f01d51af94707ad9b30e5a9888e7966a936b11b96b015f28c927f28775a9ae7bde1e46121e8d8b8cc764d3fa424d6f668900b0e4e56a038736f59a8450cae5313e765fdb0022736fe1432fee9b5ce8fb7c8a6fe0b39d6e08dc6b3f4082696f2b71d385d4116a05015cf9566cf6849bdfd0b46f6a9a4a79a761b0d23e1562708e99c5a9176fdda0a2e658acdac443e456fdd5938358784753813eda13c09a0b39994f4f8f6826c9bcd2c8398776023feae7b3e7a37de939171023607761354e0afc93ac45ebc9869446c523c9fac41a5d60baf938523dfb179796264f51ecb47aff9d8dfd75e41dc23e8639aad29efb23dfc9b2f992c37af29957c43f3908e1889512869cc985984f59b7241d7bff29edb15b486412fad8f2d3b25c62e6583ac00818258203f5e6e7609563dc76da29430dca199c461af469c750c10098a0eb9be1ab4507a000d81825820c5f70d555f6bd7063f56c152b1323c0ef45bfa107de0ecec1d1085b22e06846b00128282582010296c81eb52b78f04d0a1e589e81ea20ac485c20bcab0de864805af40e2fde801825820697b8d75dc276a85874e84648178bf5e5868bdc55dab1a238a16d84485a7ebae000182825839017ea993ffa5896d519f002837b89865bb4ad1089547189f107b344c0163224bb5a4bfe92593f3dcf3b7d0ebbf1a8ff2bc64a2cb3f93ed94a1821a0072ea0da1581c8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61a14c446a65644d6963726f5553441a3c67f29e825839017ea993ffa5896d519f002837b89865bb4ad1089547189f107b344c0163224bb5a4bfe92593f3dcf3b7d0ebbf1a8ff2bc64a2cb3f93ed94a1821a00118f32a1581c0dffd1d6f67df6d086b73e3d9a4576d697acc358a57b3c3882b1bf05a147714971565151410110825839010b4aeba7566a53111bfa7fcf6a04d47e7b37bfc1aa56ca247544b8a0b5af9ae7c866e994de2f41661660489d00ccb4d83fd31df8d37f968b1a3b95a3b3111a0005264d021a00036ede031a07b24f92081a07b2488a0e81581c771d5a28a99b9efa419d323f05605e7d89cdf22970617fe2069b3c240b58209a527f0e17542499c22aaa77bffca8f08b09b6efa8ae322cebdc5b7453e5cf8a075820c5a2e8fe5eac63b109e73529567b40a6ae0b94ae40fa44604ad03dd9ef255914a4008182582053394ed87f9791f37b1886c26debdfc2e6b23e6497b341f2c194664d644c889e00018182581d61df55a3397ee2e7784588afaab8654fc172860dbccc8d60964f1a8e7d1a034addc5021a00029234031a07b25ffaa70083825820a4fa0caf5d5f7e45dde95bc4ca28a8d45401eef757c6e0f764bafcdc8738859c01825820a4fa0caf5d5f7e45dde95bc4ca28a8d45401eef757c6e0f764bafcdc8738859c02825820bb907e4904505852be2ff969527bed1ae71cc5bbb26b03fe1e655420b0f8c66500018382583901221464ba6ba6c903b9c9432c300d3b7125cf199f86d04b30d85945077fbce0e2256760561ec87bc65447a7fc4fa9bd24d8bc73eef13bbe35821a001add65a1581c29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6a1434d494e1a01c7d38082583901adb1bf6a51b20ff1b8450726ef3891bb0e153d5bf47783375e2134afbd6a096cbba5e259946798e948403e2d2b3d9ea88a12ee8e7ae944971b0000001ee3f5888082583901adb1bf6a51b20ff1b8450726ef3891bb0e153d5bf47783375e2134afbd6a096cbba5e259946798e948403e2d2b3d9ea88a12ee8e7ae94497821a0049433cb4581c133fac9e153194428eb0919be39837b42b9e977fc7298f3ff1b76ef9a14550554447591b00001466ac60624a581c160a880d9fc45380737cb7e57ff859763230aab28b3ef6a84007bfcca1444d4952411a25e02fcd581c29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6a1434d494e1b0000141f8cab2093581c2d92af60ee429bce238d3fd9f2531b45457301d74dad1bcf3f9d1dcaa143564e4d1b000000019a2e51a4581c4623ab311b7d982d8d26fcbe1a9439ca56661aafcdcd8d8a0ef31fd6a146475245454e531b0000000d4f6f7c63581c724a31d1421744cac3bb1d547aa692b43517d651c46e60a0cf1f70eca144444f444f1a025192d6581c9a1dfe73344033e70deab8c5c28c00f62b092814fb14581ec3a3d516a1480014df10434f44451b00030599b9c42a4d581c9abf0afd2f236a19f2842d502d0450cbcd9c79f123a9708f96fd9b96a144454e43531b00000005609e757d581c9f452e23804df3040b352b478039357b506ad3b50d2ce0d7cbd5f806a143435456192bd1581ca1ce0414d79b040f986f3bcd187a7563fd26662390dece6b12262b52a14b464c45534820544f4b454e1b002cb1f77aa5589c581cbf3e19192da77dfadc7c9065944e50ca7e1a439d90833e3ae58b720aa14544414e5a4f1a381a94c5581cbfa9354862e34f2dd417c9068a9367b530d1a704a0f5dc41468c402ca14550524f434b1a711694b8581cca942cb8bb5d1ef750766ded355f320880539111f10efa2b1a478ff9a1435241471a000bb5a0581ccc8d1b026353022abbfcc2e1e71159f9e308d9c6e905ac1db24c7fb6a147506172696275731b00000282d10d2121581cce5b9e0f8a88255b65f2e4d065c6e716e9fa9a8a86dfb86423dd1ac0a14444494e471b000000a1849ac725581cea02c99c0668891d6b7cdc49e075cbddf9cd5b89404e5a8a8e5d7016a149534c4f5020436f696e1a009619f8581cee0633e757fdd1423220f43688c74678abde1cead7ce265ba8a24fcda14443424c501b00000097609c36be581cf4d97191f857096b441a410c036f63d6697dde0c71d2755dd664e302a1434d4b411b0000006b321949af581cf7516c9f7b347eb412a777f3c711099b199ccd2be23b568a4a3abf6da1435350581b000036c03d572562581cfb59da920d029dde957b556d981046a9102698ed70797da5908e4634a147454c454d454e541a019a2255021a00037ae5031a07b272bd075820dceb615df4c37cb35edc022e11faba4f98e042261a24cb1e2bca0cc3e4dcc45709a1581cd195ca7db29f0f13a00cac7fca70426ff60bad4e1e87d3757fae8484a24568764144413a00094e324568764d494e3a01c7d37f0e81581c4f641455f17911fe2f55ad3ad67fc2e0b2946b59af3352574322e67e83a20082825820653f3e9b4fe440fdfbc3b77918fdfecd96f00d26ba90310f1de689f8a59a4e70584044f308256ae6703d7c6613ee265913d094c091fb54c214d1123cb1dcb6c474b0d6443710679cc307e282957b2f6a9e0874d2fab9055ed712bdbb402d33f05505825820bd1eef47a3dea42dad00dde4cdff2a34e448e0ec5d46fb120320efc6d5125e3c5840a02fb461e2e97541919c916c445247fe093c397f0c5711f3295732e96597c875b5ec5694b6328051873791886a0bc4710d3276208356435eab9d9a73857a7d050581840000d87e80821a0005c5071a085f226ea1008182582004cb92473bd4dd8e53a8de6ebf91c10d7c7fbf6a19fad99509dfa3a9c06cd61d584049c48c79f42942143f0173975dc0f7222cb2f76fc1f807f72e7fd68a1738187d2f9f78405bce5fc27d6eb10ba1615a21dabdb77107766b03abe70ddd48388e0fa200828258200621257bb5bd1477c0960b2e391c70baa8a642ad258420daa10bab85d1c24bef584065d55e65c49b4204efefb66b02bd6f21cd6b9191ec859465dd7bfd3ba3061762625a1d4cad4086b5ec02c816b7c12ad5c4ec4f0bf83b8e31992f5fcea795b30c8258205424fa10ba83c95c33714c420479c19183a7274e7c1d4161d173842c245b340c58407c2d72a63e8398b9aaab1fa445529f72d13dc7d0421cbf017fcf0155733fbb0cf5381dd7ae1c747b1c12deaefaa5e2caf4e463bd168747dd1296f709c940b80601818200581c4f641455f17911fe2f55ad3ad67fc2e0b2946b59af3352574322e67ea200d90103a100a11902a2a1636d7367827741786f3a20436c6f7365642062792050726f746f636f6c77526561736f6e3a20547261646520436f6d706c6574656402a11902a2a1636d736781734d696e737761703a204d61737465724368656680';
    const thisBlock = CardanoBlock.from_explicit_network_cbor_bytes(fromHex(cborHex));
    const blockData = JSON.parse(thisBlock.to_json());
    const babbageBlock = thisBlock.as_babbage() as BabbageBlock;
    const blockHeight = babbageBlock.header().header_body().block_number();
    const transactionBodies = babbageBlock.transaction_bodies();
    console.log('Block height: ', blockHeight);
    console.log('transactionBodies: ', transactionBodies.get(0).to_cbor_hex());

    // const babbageBlock = block.as_babbage() as BabbageBlock;
    // const blockHeight = babbageBlock.header().header_body().block_number();
    // const transactionBodies = babbageBlock.transaction_bodies();
    // console.log('Block height: ', blockHeight);
    // console.log('transactionBodies: ', transactionBodies.get(0).to_cbor_hex());

    // const txOutputs = extractTxOutput(transactionBodies as BabbageTransactionBodyList);
    // for (const txOutput of txOutputs) {
    //   if (hasTokenPrefix(txOutput.assets, clientTokenPrefix)) {
    //     const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
    //     if (!transactionWitnessSets.redeemers()?.len()) continue;
    //     const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

    //     await handleParseClientEvents(txOutput, redeemers, blockHeight);
    //   }
    //   if (hasTokenPrefix(txOutput.assets, connectionTokenPrefix)) {
    //     const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
    //     if (!transactionWitnessSets.redeemers()?.len()) continue;
    //     const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

    //     await handleParseConnectionEvents(txOutput, redeemers, blockHeight);
    //   }
    //   if (hasTokenPrefix(txOutput.assets, channelTokenPrefix)) {
    //     const transactionWitnessSets = babbageBlock.transaction_witness_sets().get(txOutput.txIndex);
    //     if (!transactionWitnessSets.redeemers()?.len()) continue;
    //     const redeemers = transactionWitnessSets.redeemers() as AlonzoRedeemerList;

    //     await handleParseChannelEvents(txOutput, redeemers, blockHeight);
    //   }
    // }
  } catch (error) {
    console.error('Handler Cardano Block ERR: ', error);
  }
}

// async function handleParseClientEvents(
//   txOutput: TxOutput,
//   redeemers: AlonzoRedeemerList,
//   blockHeight: bigint
// ): Promise<void> {
//   try {
//     console.log(`handleParseClientEvents starting`);
//     const clientDatum = Data.from(txOutput.datum, ClientDatum);
//     const latestConsensus = [...clientDatum.state.consensus_states].at(-1);
//     const fstRedeemerData = redeemers.get(0).data();

//     const event = Event.create({
//       id: `${txOutput.hash}-${txOutput.txIndex}`,
//       blockHeight: blockHeight,
//       txHash: txOutput.hash,
//       type: EventType.CreateClient,
//     });
//     const eventAttributes: {key: string; value: string}[] = [
//       {
//         key: EventAttributeClient.AttributeKeyClientID,
//         value: getIdFromTokenAssets(txOutput.assets, handler.handlerAuthToken, CLIENT_PREFIX),
//       },
//       {
//         key: EventAttributeClient.AttributeKeyConsensusHeight,
//         value: latestConsensus?.[0].revision_height.toString() ?? '',
//       },
//       {
//         key: EventAttributeClient.AttributeKeyHeader,
//         value: '',
//       },
//     ];

//     if (fstRedeemerData.as_constr_plutus_data()?.fields().len() == 0) {
//       // for create client
//       // const handlerOperatorRedeemerHex = fstRedeemerData.to_cbor_hex();
//       // const handlerOperatorRedeemer = Data.from(handlerOperatorRedeemerHex, HandlerOperator);
//       event.type = EventType.CreateClient;

//       // eventAttributes.push({
//       //   key: EventAttributeClient.AttributeKeyHeader,
//       //   value: '',
//       // });
//     } else {
//       // for update client
//       const spendClientRedeemerHex = redeemers.get(0).data().to_cbor_hex();
//       const spendClientRedeemer = Data.from(spendClientRedeemerHex, SpendClientRedeemer);
//       event.type = EventType.UpdateClient;

//       let header = '';
//       if (spendClientRedeemer.valueOf().hasOwnProperty('UpdateClient')) {
//         // TODO: get header update client
//         // const UpdateClientSchema = Data.Object({UpdateClient: Data.Object({msg: ClientMessageSchema})});
//         // type UpdateClientSchema = Data.Static<typeof UpdateClientSchema>;
//         // const spendClientRedeemerSchema = spendClientRedeemer.valueOf() as unknown as UpdateClientSchema;
//         // const clientMessage = spendClientRedeemerSchema['UpdateClient'].msg.valueOf();
//         // if (clientMessage.hasOwnProperty('HeaderCase')) {
//         //   const clientMessage
//         // }
//       }
//       // eventAttributes.push({
//       //   key: EventAttributeClient.AttributeKeyHeader,
//       //   value: header,
//       // });
//     }

//     await event.save();
//     for (const attribute of eventAttributes) {
//       const index = eventAttributes.indexOf(attribute);
//       const eventAttribute = EventAttribute.create({
//         id: `${txOutput.hash}-${txOutput.txIndex}-${index}`,
//         eventId: event.id,
//         key: attribute.key,
//         value: attribute.value,
//       });
//       await eventAttribute.save();
//     }
//     console.log(`handleParseClientEvents end`);
//   } catch (error) {
//     console.log('Handle Parse Client Event ERR: ', error);
//   }
// }

// async function handleParseConnectionEvents(
//   txOutput: TxOutput,
//   redeemers: AlonzoRedeemerList,
//   blockHeight: bigint
// ): Promise<void> {
//   try {
//     const connectionDatum = Data.from(txOutput.datum, ConnectionDatum);
//     let eventType: EventType = EventType.ConnectionOpenInit;
//     // for connection init
//     if (connectionDatum.state.state == 'Init') {
//       const mintConnectionRedeemerHex = redeemers.get(1).data().to_cbor_hex();
//       const mintConnectionRedeemer = Data.from(mintConnectionRedeemerHex, MintConnectionRedeemer);
//       if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenInit')) eventType = EventType.ConnectionOpenInit;
//       if (mintConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenTry')) eventType = EventType.ConnectionOpenTry;
//     }
//     // for connection ack
//     if (connectionDatum.state.state == 'Open') {
//       const spendConnectionRedeemerHex = redeemers.get(0).data().to_cbor_hex();
//       const spendConnectionRedeemer = Data.from(spendConnectionRedeemerHex, SpendConnectionRedeemer);

//       if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenAck')) eventType = EventType.ConnectionOpenAck;
//       if (spendConnectionRedeemer.valueOf().hasOwnProperty('ConnOpenConfirm'))
//         eventType = EventType.ConnectionOpenConfirm;
//     }

//     const event = Event.create({
//       id: `${txOutput.hash}-${txOutput.txIndex}`,
//       blockHeight: blockHeight,
//       txHash: txOutput.hash,
//       type: eventType,
//     });
//     await event.save();
//   } catch (error) {
//     console.log('Handle Parse Connection Event ERR: ', error);
//   }
// }

// async function handleParseChannelEvents(
//   txOutput: TxOutput,
//   redeemers: AlonzoRedeemerList,
//   blockHeight: bigint
// ): Promise<void> {
//   try {
//     // case channel init
//     const channelDatum = Data.from(txOutput.datum, ChannelDatum);
//     let eventType: EventType = EventType.ChannelOpenInit;
//     if (channelDatum.state.channel.state == 'Init') {
//       const mintChannelRedeemerHex = redeemers.get(2).data().to_cbor_hex();
//       const mintChannelRedeemer = Data.from(mintChannelRedeemerHex, MintChannelRedeemer);
//       if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenInit')) eventType = EventType.ChannelOpenInit;
//       if (mintChannelRedeemer.valueOf().hasOwnProperty('ChanOpenTry')) eventType = EventType.ChannelOpenTry;
//     }
//     // channel ack
//     if (channelDatum.state.channel.state == 'Open') {
//       const spendChannelRedeemerHex = redeemers.get(0).data().to_cbor_hex();
//       const spendChannelRedeemer = Data.from(spendChannelRedeemerHex, SpendChannelRedeemer);
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenAck')) eventType = EventType.ChannelOpenAck;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanOpenConfirm')) eventType = EventType.ChannelOpenConfirm;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('RecvPacket')) eventType = EventType.RecvPacket;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('TimeoutPacket')) eventType = EventType.TimeoutPacket;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('AcknowledgePacket')) eventType = EventType.AcknowledgePacket;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('SendPacket')) eventType = EventType.SendPacket;
//       if (spendChannelRedeemer.valueOf().hasOwnProperty('ChanCloseConfirm')) eventType = EventType.ChannelCloseConfirm;
//     }

//     const event = Event.create({
//       id: `${txOutput.hash}-${txOutput.txIndex}`,
//       blockHeight: blockHeight,
//       txHash: txOutput.hash,
//       type: eventType,
//     });
//     await event.save();
//   } catch (error) {
//     console.log('Handle Parse Channel Event ERR: ', error);
//   }
// }
