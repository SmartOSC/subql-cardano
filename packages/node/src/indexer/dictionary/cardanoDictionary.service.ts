// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NETWORK_FAMILY } from '@subql/common';
import { isCustomDs } from '@subql/common-cardano';
import { NodeConfig, DictionaryService, getLogger } from '@subql/node-core';
import { CardanoBlock, CardanoDatasource } from '@subql/types';
import { DsProcessor } from '@subql/types-core';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { DsProcessorService } from '../ds-processor.service';
import { SpecVersion } from './types';
import { CardanoDictionaryV1 } from './v1';
import { CardanoDictionaryV2 } from './v2';

const logger = getLogger('SubstrateDictionary');

@Injectable()
export class CardanoDictionaryService extends DictionaryService<
  CardanoDatasource,
  CardanoBlock
> {
  async initDictionaries(): Promise<void> {
    const dictionariesV1: CardanoDictionaryV1[] = [];
    const dictionariesV2: CardanoDictionaryV2[] = [];

    if (!this.project) {
      throw new Error(`Project in Dictionary service not initialized `);
    }
    const registryDictionaries = await this.resolveDictionary(
      NETWORK_FAMILY.cardano,
      this.project.network.chainId,
      this.nodeConfig.dictionaryRegistry,
    );
    if (registryDictionaries.length === 0) return;

    logger.debug(`Dictionary registry endpoints: ${registryDictionaries}`);

    const dictionaryEndpoints: string[] = (
      !Array.isArray(this.project.network.dictionary)
        ? !this.project.network.dictionary
          ? []
          : [this.project.network.dictionary]
        : this.project.network.dictionary
    ).concat(registryDictionaries);

    for (const endpoint of dictionaryEndpoints) {
      try {
        const dictionaryV2 = await CardanoDictionaryV2.create(
          endpoint,
          this.nodeConfig,
          this.project,
          this.project.network.chainId,
        );
        dictionariesV2.push(dictionaryV2);
      } catch (e) {
        try {
          const dictionaryV1 = await CardanoDictionaryV1.create(
            this.project,
            this.nodeConfig,
            this.dsProcessorService.getDsProcessor.bind(
              this.dsProcessorService,
            ),
            endpoint,
          );
          dictionariesV1.push(dictionaryV1);
        } catch (e) {
          logger.warn(
            `Dictionary endpoint "${endpoint}" is not a valid dictionary`,
          );
        }
      }
    }

    // v2 should be prioritised
    this.init([...dictionariesV2, ...dictionariesV1]);
  }

  constructor(
    @Inject('ISubqueryProject') protected project: SubqueryProject,
    nodeConfig: NodeConfig,
    eventEmitter: EventEmitter2,
    protected dsProcessorService: DsProcessorService,
  ) {
    super(project.network.chainId, nodeConfig, eventEmitter);
  }

  private getV1Dictionary(): CardanoDictionaryV1 | undefined {
    // TODO this needs to be removed once Substrate supports V2 dictionaries
    if (this._currentDictionaryIndex === undefined) return undefined;
    const dict = this._dictionaries[this._currentDictionaryIndex];
    if (!dict) return undefined;
    assert(
      dict instanceof CardanoDictionaryV1,
      `Getting v1 dict returned a dictinoary that wasn't v1`,
    );
    return dict;
  }

  async getSpecVersions(): Promise<SpecVersion[] | undefined> {
    const dict = this.getV1Dictionary();
    if (!dict) return undefined;
    return dict.getSpecVersions();
  }
}
