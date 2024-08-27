// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {CardanoDatasource} from '@subql/types';
import {IProjectManifest} from '@subql/types-core';

// All of these used to be redefined in this file, re-exporting for simplicity
export {
  CardanoRuntimeHandler,
  CardanoCustomHandler,
  CardanoHandler,
  CardanoHandlerKind,
  CardanoDatasource as CardanoDataSource,
  CardanoCustomDatasource as CardanoCustomDataSource,
  CardanoBlockFilter,
  CardanoCallFilter,
  CardanoEventFilter,
  CardanoDatasourceProcessor,
  CardanoRuntimeHandlerFilter,
  CardanoDatasourceKind,
  RuntimeHandlerInputMap as CardanoRuntimeHandlerInputMap,
} from '@subql/types';

//make exception for runtime datasource 0.0.1
export type ICardanoProjectManifest = IProjectManifest<CardanoDatasource>;
