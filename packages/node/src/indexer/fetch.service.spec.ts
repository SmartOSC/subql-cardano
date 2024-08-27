// // Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// // SPDX-License-Identifier: GPL-3.0

import {
  CardanoBlockHandler,
  CardanoCallHandler,
  CardanoDatasource,
  CardanoDatasourceKind,
  CardanoHandlerKind,
  CardanoRuntimeHandler,
} from '@subql/types';
// import { DictionaryQueryEntry } from '@subql/types-core';
// import { FetchService } from './fetch.service';
// import { ProjectService } from './project.service';

// const projectService: ProjectService = {
//   getAllDataSources: () => {
//     return [
//       makeDs([{ ...blockHandler, filter: { modulo: 5 } }]),
//       makeDs([callHandler]),
//       makeDs([eventHandler, { ...blockHandler, filter: { modulo: 2 } }]),
//     ];
//   },
// } as any;

// const blockHandler: CardanoBlockHandler = {
//   kind: CardanoHandlerKind.Block,
//   handler: 'handleBlock',
// };
// const callHandler: CardanoCallHandler = {
//   kind: CardanoHandlerKind.Call,
//   handler: 'handleCall',
//   filter: { method: 'call', module: 'module' },
// };
// const eventHandler: CardanoEventHandler = {
//   kind: CardanoHandlerKind.Event,
//   handler: 'handleEvent',
//   filter: { method: 'event', module: 'module' },
// };

// const makeDs = (handlers: CardanoRuntimeHandler[]) => {
//   return {
//     name: '',
//     kind: CardanoDatasourceKind.Runtime,
//     mapping: {
//       file: '',
//       handlers,
//     },
//   };
// };

// describe('FetchSevice', () => {
//   let fetchService: FetchService & {
//     buildDictionaryQueryEntries: (
//       ds: CardanoDatasource[],
//     ) => DictionaryQueryEntry[]; // This is protected so we expose it here
//     getModulos: () => number[];
//   };

//   beforeEach(() => {
//     fetchService = new FetchService(
//       null as any, // ApiService
//       null as any, // NodeConfig
//       projectService, // ProjectService
//       {} as any, // Project
//       null as any, // BlockDispatcher,
//       null as any, // DictionaryService
//       null as any, // UnfinalizedBlocks
//       null as any, // EventEmitter
//       null as any, // SchedulerRegistry
//       null as any, // RuntimeService
//     ) as any;
//   });

//   it('can extract modulo numbers from all datasources', () => {
//     expect(
//       (fetchService as any).getModulos(projectService.getAllDataSources()),
//     ).toEqual([5, 2]);
//   });
// });
