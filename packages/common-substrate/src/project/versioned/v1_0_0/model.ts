// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {
  BaseDeploymentV1_0_0,
  FileType,
  ParentProjectModel,
  ProjectManifestBaseImpl,
  RunnerNodeImpl,
  RunnerQueryBaseModel,
  validateObject,
  CommonProjectNetworkV1_0_0,
} from '@subql/common';
import {
  CardanoCustomDatasource,
  CardanoRuntimeDatasource,
  CustomDatasourceTemplate,
  RuntimeDatasourceTemplate,
  CardanoProjectManifestV1_0_0,
} from '@subql/types';
import {BaseMapping, NodeSpec, ParentProject, QuerySpec, RunnerSpecs} from '@subql/types-core';
import {plainToInstance, Transform, TransformFnParams, Type} from 'class-transformer';
import {Equals, IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested} from 'class-validator';
import {CustomDataSourceBase, RuntimeDataSourceBase} from '../../models';

const CARDANO_NODE_NAME = `@subql/node`;

export class CardanoRunnerNodeImpl extends RunnerNodeImpl {
  @Equals(CARDANO_NODE_NAME, {message: `Runner Cardano node name incorrect, suppose be '${CARDANO_NODE_NAME}'`})
  name: string = CARDANO_NODE_NAME;
}

export class CardanoRuntimeDataSourceImpl extends RuntimeDataSourceBase implements CardanoRuntimeDatasource {
  validate(): void {
    return validateObject(this, 'failed to validate runtime datasource.');
  }
}

export class CardanoCustomDataSourceImpl<K extends string = string, M extends BaseMapping<any> = BaseMapping<any>>
  extends CustomDataSourceBase<K, M>
  implements CardanoCustomDatasource<K, M>
{
  validate(): void {
    return validateObject(this, 'failed to validate custom datasource.');
  }
}

export class RuntimeDatasourceTemplateImpl extends CardanoRuntimeDataSourceImpl implements RuntimeDatasourceTemplate {
  @IsString()
  name!: string;
}

export class CustomDatasourceTemplateImpl extends CardanoCustomDataSourceImpl implements CustomDatasourceTemplate {
  @IsString()
  name!: string;
}

export class CardanoRunnerSpecsImpl implements RunnerSpecs {
  @IsObject()
  @ValidateNested()
  @Type(() => CardanoRunnerNodeImpl)
  node!: NodeSpec;
  @IsObject()
  @ValidateNested()
  @Type(() => RunnerQueryBaseModel)
  query!: QuerySpec;
}

// ChainTypes is different with other network
export class ProjectNetworkDeploymentV1_0_0 {
  @IsNotEmpty()
  @Transform(({value}: TransformFnParams) => value.trim())
  @IsString()
  chainId!: string;
  @ValidateNested()
  @Type(() => FileType)
  @IsOptional()
  chaintypes?: FileType = undefined;
  @IsOptional()
  @IsArray()
  bypassBlocks?: (number | string)[];
}

export class ProjectNetworkV1_0_0 extends CommonProjectNetworkV1_0_0<FileType> {
  @Type(() => FileType)
  @IsOptional()
  chaintypes?: FileType = undefined;
}

export class DeploymentV1_0_0 extends BaseDeploymentV1_0_0 {
  @Transform((params) => {
    if (params.value.genesisHash && !params.value.chainId) {
      params.value.chainId = params.value.genesisHash;
    }
    return plainToInstance(ProjectNetworkDeploymentV1_0_0, params.value);
  })
  @ValidateNested()
  @Type(() => ProjectNetworkDeploymentV1_0_0)
  network!: ProjectNetworkDeploymentV1_0_0;
  @IsObject()
  @ValidateNested()
  @Type(() => CardanoRunnerSpecsImpl)
  runner!: RunnerSpecs;
  @IsArray()
  @ValidateNested()
  @Type(() => CardanoCustomDataSourceImpl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: CardanoRuntimeDataSourceImpl, name: 'cardano/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources!: (CardanoRuntimeDatasource | CardanoCustomDatasource)[];
  @IsOptional()
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDatasourceTemplateImpl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: RuntimeDatasourceTemplateImpl, name: 'cardano/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  templates?: (RuntimeDatasourceTemplate | CustomDatasourceTemplate)[];
}

export class ProjectManifestV1_0_0Impl
  extends ProjectManifestBaseImpl<DeploymentV1_0_0>
  implements CardanoProjectManifestV1_0_0
{
  constructor() {
    super(DeploymentV1_0_0);
  }

  @Equals('1.0.0')
  specVersion = '1.0.0';
  @Type(() => CardanoCustomDataSourceImpl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: CardanoRuntimeDataSourceImpl, name: 'cardano/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources!: (CardanoRuntimeDatasource | CardanoCustomDatasource)[];
  @Type(() => ProjectNetworkV1_0_0)
  network!: ProjectNetworkV1_0_0;
  @IsOptional()
  @IsString()
  name?: string;
  @IsString()
  version!: string;
  @ValidateNested()
  @Type(() => FileType)
  schema!: FileType;
  @IsOptional()
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDatasourceTemplateImpl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: RuntimeDatasourceTemplateImpl, name: 'cardano/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  templates?: (RuntimeDatasourceTemplate | CustomDatasourceTemplate)[];
  @IsObject()
  @ValidateNested()
  @Type(() => CardanoRunnerSpecsImpl)
  runner!: RunnerSpecs;

  @IsOptional()
  @IsObject()
  @Type(() => ParentProjectModel)
  parent?: ParentProject;
}
