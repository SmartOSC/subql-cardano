// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {
  SecondLayerHandlerProcessor,
  CardanoCustomDatasource,
  CardanoDatasource,
  CardanoDatasourceKind,
  CardanoHandlerKind,
  CardanoRuntimeDatasource,
  CardanoMapping,
  CardanoCustomHandler,
  SecondLayerHandlerProcessorArray,
} from '@subql/types';
import {BaseTemplateDataSource} from '@subql/types-core';

export function isBlockHandlerProcessor<F extends Record<string, unknown>, E>(
  hp: SecondLayerHandlerProcessorArray<CardanoHandlerKind, F, unknown>
): hp is SecondLayerHandlerProcessor<CardanoHandlerKind.Block, F, E> {
  return hp.baseHandlerKind === CardanoHandlerKind.Block;
}

// export function isEventHandlerProcessor<F extends Record<string, unknown>, E>(
//   hp: SecondLayerHandlerProcessorArray<CardanoHandlerKind, F, unknown>
// ): hp is SecondLayerHandlerProcessor<CardanoHandlerKind.Event, F, E> {
//   return hp.baseHandlerKind === CardanoHandlerKind.Event;
// }

export function isCallHandlerProcessor<F extends Record<string, unknown>, E>(
  hp: SecondLayerHandlerProcessorArray<CardanoHandlerKind, F, unknown>
): hp is SecondLayerHandlerProcessor<CardanoHandlerKind.Call, F, E> {
  return hp.baseHandlerKind === CardanoHandlerKind.Call;
}

export function isCustomDs<F extends CardanoMapping<CardanoCustomHandler>>(
  ds: CardanoDatasource | BaseTemplateDataSource<CardanoDatasource>
): ds is CardanoCustomDatasource<string, F> {
  return ds.kind !== CardanoDatasourceKind.Runtime && !!(ds as CardanoCustomDatasource<string, F>).processor;
}

export function isRuntimeDs(ds: CardanoDatasource): ds is CardanoRuntimeDatasource {
  return ds.kind === CardanoDatasourceKind.Runtime;
}
