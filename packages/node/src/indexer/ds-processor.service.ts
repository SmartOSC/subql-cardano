// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Injectable } from '@nestjs/common';
import { isCustomDs } from '@subql/common-substrate';
import { BaseDsProcessorService } from '@subql/node-core';
import {
  CardanoCustomDatasource,
  CardanoCustomHandler,
  CardanoDatasource,
  CardanoDatasourceProcessor,
  CardanoMapping,
} from '@subql/types';

@Injectable()
export class DsProcessorService extends BaseDsProcessorService<
  CardanoDatasource,
  CardanoCustomDatasource<string, CardanoMapping<CardanoCustomHandler>>,
  CardanoDatasourceProcessor<string, Record<string, unknown>>
> {
  protected isCustomDs = isCustomDs;
}
