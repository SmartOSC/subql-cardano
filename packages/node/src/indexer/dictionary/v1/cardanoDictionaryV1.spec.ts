// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { EventEmitter2 } from '@nestjs/event-emitter';
import { NodeConfig } from '@subql/node-core';
import {
  CardanoBlockHandler,
  CardanoCallHandler,
  CardanoDatasourceKind,
  // CardanoEventHandler,
  CardanoHandlerKind,
  CardanoRuntimeHandler,
} from '@subql/types';
import { GraphQLSchema } from 'graphql';
import { SubqueryProject } from '../../../configure/SubqueryProject';
import { DsProcessorService } from '../../ds-processor.service';
import { CardanoDictionaryService } from '../cardanoDictionary.service';
import { buildDictionaryV1QueryEntries } from './cardanoDictionaryV1';

function testSubqueryProject(): SubqueryProject {
  return new SubqueryProject(
    'test',
    './',
    {
      endpoint: '',
      chainId:
        '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3',
    },
    [],
    new GraphQLSchema({}),
    [],
  );
}
const nodeConfig = new NodeConfig({
  subquery: 'asdf',
  subqueryName: 'asdf',
  dictionaryTimeout: 10,
});

describe('Cardano DictionaryService', () => {
  it('should return all specVersion', async () => {
    const project = testSubqueryProject();
    const dictionaryService = new CardanoDictionaryService(
      project,
      nodeConfig,
      new EventEmitter2(),
      new DsProcessorService(project, nodeConfig),
    );

    // prepare dictionary service
    await dictionaryService.initDictionaries();
    // mock set dictionary (without ds)
    (dictionaryService as any)._currentDictionaryIndex = 0;

    const specVersions = await dictionaryService.getSpecVersions();

    expect(specVersions?.length).toBeGreaterThan(0);
    dictionaryService.onApplicationShutdown();
  }, 50000);
});

const makeDs = (handlers: CardanoRuntimeHandler[]) => {
  return {
    name: '',
    kind: CardanoDatasourceKind.Runtime,
    mapping: {
      file: '',
      handlers,
    },
  };
};
const blockHandler: CardanoBlockHandler = {
  kind: CardanoHandlerKind.Block,
  handler: 'handleBlock',
};
const callHandler: CardanoCallHandler = {
  kind: CardanoHandlerKind.Call,
  handler: 'handleCall',
  filter: { method: 'call', module: 'module' },
};
// const eventHandler: CardanoEventHandler = {
//   kind: CardanoHandlerKind.Event,
//   handler: 'handleEvent',
//   filter: { method: 'event', module: 'module' },
// };

// const eventHandlerWithUndefined: CardanoEventHandler = {
//   kind: CardanoHandlerKind.Event,
//   handler: 'handleEvent',
//   filter: { method: 'balance', module: undefined },
// };

const callHandlerWithUndefined: CardanoCallHandler = {
  kind: CardanoHandlerKind.Call,
  handler: 'handleCall',
  filter: { isSigned: true, module: undefined, method: undefined },
};

describe('Building dictionary query entries', () => {
  it('supports block handlers', () => {
    /* If there are any blockhandlers without a modulo or timestamp filter we expect no query entries */
    const result1 = buildDictionaryV1QueryEntries(
      [makeDs([blockHandler])],
      () => undefined as any,
    );
    expect(result1).toEqual([]);

    const result2 = buildDictionaryV1QueryEntries(
      [makeDs([blockHandler, callHandler])],
      () => undefined as any,
    );
    expect(result2).toEqual([]);

    const result3 = buildDictionaryV1QueryEntries(
      [makeDs([blockHandler]), makeDs([callHandler])],
      () => undefined as any,
    );
    expect(result3).toEqual([]);
  });

  it('supports block handlers with modulo filter', () => {
    const result1 = buildDictionaryV1QueryEntries(
      [
        makeDs([
          { ...blockHandler, filter: { modulo: 5 } },
          callHandler,
        ]),
      ],
      () => undefined as any,
    );
    expect(result1).toEqual([
      {
        entity: 'extrinsics',
        conditions: [
          { field: 'call', value: 'call' },
          { field: 'module', value: 'module' },
        ],
      },
      {
        entity: 'events',
        conditions: [
          { field: 'event', value: 'event' },
          { field: 'module', value: 'module' },
        ],
      },
    ]);
  });

  it('supports any handler with no filters', () => {
    const result1 = buildDictionaryV1QueryEntries(
      [makeDs([{ kind: CardanoHandlerKind.Call, handler: 'handleCall' }])],
      () => undefined as any,
    );
    expect(result1).toEqual([]);

    // const result2 = buildDictionaryV1QueryEntries(
    //   [makeDs([{ kind: CardanoHandlerKind.Event, handler: 'handleEvent' }])],
    //   () => undefined as any,
    // );
    // expect(result2).toEqual([]);
  });

  it('supports custom ds processors', () => {
    // mock custom ds processor dictionary return
    const processors: Record<string, any> = {
      'Cardano/JsonfyCall': {
        baseHandlerKind: {},
        dictionaryQuery: () => {
          return {
            conditions: [
              {
                field: 'filter1',
                value: 'foo',
              },
              {
                field: 'filter2',
                value: 'bar',
              },
            ],
            entity: 'json',
          };
        },
      },
    };
    // Processor WITH custom dictionary query
    const result1 = buildDictionaryV1QueryEntries(
      [
        {
          kind: 'Cardano/Jsonfy',
          processor: { file: '' },
          assets: new Map(),
          mapping: {
            file: '',
            handlers: [
              {
                kind: 'Cardano/JsonfyCall',
                handler: 'handleCall',
                filter: {
                  filter1: 'foo',
                  filter2: 'bar',
                },
              },
            ],
          },
        },
      ],
      (ds) => {
        return {
          kind: 'Cardano/Jsonfy',
          validate: () => true,
          dsFilterProcessor: (ds) => true,
          handlerProcessors: processors,
        };
      },
    );

    expect(result1).toEqual([
      {
        entity: 'json',
        conditions: [
          { field: 'filter1', value: 'foo' },
          { field: 'filter2', value: 'bar' },
        ],
      },
    ]);
  });

  it('create dictionary call filter condition and remove undefined fields', () => {
    const result1 = buildDictionaryV1QueryEntries(
      [makeDs([callHandlerWithUndefined])],
      () => undefined as any,
    );
    expect(result1).toEqual([
      {
        conditions: [
          {
            field: 'isSigned',
            value: true,
          },
        ],
        entity: 'extrinsics',
      },
    ]);
  });

  // it('create dictionary event filter condition and remove undefined fields', () => {
  //   const result1 = buildDictionaryV1QueryEntries(
  //     [makeDs([eventHandlerWithUndefined])],
  //     () => undefined as any,
  //   );
  //   expect(result1).toEqual([
  //     {
  //       conditions: [
  //         {
  //           field: 'event',
  //           value: 'balance',
  //         },
  //       ],
  //       entity: 'events',
  //     },
  //   ]);
  // });
});
