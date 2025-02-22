// // Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// // SPDX-License-Identifier: GPL-3.0

// import { ApiPromise, WsProvider } from '@polkadot/api';
// import { ApiService } from './api.service';
// import { FetchService } from './fetch.service';
// import { createCachedProvider } from './x-provider/cachedProvider';

// const WS_POLKADOT_ENDPOINT = 'wss://rpc.polkadot.io';

// describe('FetchService', () => {
//   let fetchService: FetchService;
//   let api: ApiPromise;

//   beforeAll(async () => {
//     api = await ApiPromise.create({
//       provider: createCachedProvider(new WsProvider(WS_POLKADOT_ENDPOINT)),
//     });

//     const apiService = {
//       unsafeApi: api,
//     } as any as ApiService;

//     fetchService = new FetchService(
//       apiService, // ApiService
//       null as any, // NodeConfig
//       null as any, // ProjectService
//       {} as any, // Project
//       null as any, // BlockDispatcher,
//       null as any, // DictionaryService
//       {
//         registerFinalizedBlock: () => {
//           /* Nothing */
//         },
//       } as any, // UnfinalizedBlocks
//       null as any, // EventEmitter
//       null as any, // SchedulerRegistry
//       null as any, // RuntimeService
//     ) as any;
//   }, 10000);

//   afterAll(async () => {
//     await api.disconnect();
//   });

//   it('can get the finalized height', async () => {
//     const height = await (fetchService as any).getFinalizedHeight();
//     expect(height).toBeGreaterThan(0);
//   });

//   it('can get the best height', async () => {
//     const height = await (fetchService as any).getBestHeight();
//     expect(height).toBeGreaterThan(0);
//   });

//   it('can get the chain interval', async () => {
//     const interval = await (fetchService as any).getChainInterval();
//     expect(interval).toEqual(5000);
//   });
// });
