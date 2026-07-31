import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  AccountKind,
  AccountPlanKind,
  AccountPlanType,
  RecordStatus,
  StructureStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Conta do plano de contas (seção "Plano de Contas" do prompt de estrutura financeira). */
export class CreateAccountPlanDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description:
      'Empresa dona da conta. Ausente = conta compartilhada por toda a organização.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Conta pai na árvore.' })
  @IsOptional()
  @IsUUID()
  parentAccountId?: string;

  @ApiPropertyOptional({
    example: '1.1.01',
    description:
      'Obrigatório quando `autoGenerateCode` é falso. Deve iniciar pelo código da conta superior.',
  })
  @ValidateIf((dto: CreateAccountPlanDto) => dto.autoGenerateCode !== true)
  @IsString()
  @IsNotEmpty({
    message:
      'Informe o código da conta ou habilite a geração automática de código.',
  })
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Quando verdadeiro, o back-end gera o próximo código disponível a partir da conta superior (seção 13).',
  })
  @IsOptional()
  @IsBoolean()
  autoGenerateCode?: boolean;

  @ApiProperty({ example: 'Caixa' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição da conta.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'Caixa',
    description: 'Nome curto usado em relatórios e listas compactas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: AccountPlanType,
    default: AccountPlanType.EXPENSE,
  })
  @IsOptional()
  @IsEnum(AccountPlanType)
  accountType?: AccountPlanType;

  @ApiPropertyOptional({
    enum: AccountKind,
    default: AccountKind.ANALYTICAL,
    description:
      'Contas sintéticas agrupam e não aceitam lançamentos; analíticas são as folhas.',
  })
  @IsOptional()
  @IsEnum(AccountKind)
  accountKind?: AccountKind;

  @ApiPropertyOptional({
    enum: AccountPlanKind,
    default: AccountPlanKind.MANAGEMENT,
    description:
      'Finalidade do plano: gerencial, financeiro, contábil ou híbrido.',
  })
  @IsOptional()
  @IsEnum(AccountPlanKind)
  planType?: AccountPlanKind;

  @ApiPropertyOptional({ description: 'Versão do plano de contas.' })
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional({
    description: 'Agrupamento livre para apresentação em relatórios.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Ignorado (forçado a `false`) quando a conta é sintética.',
  })
  @IsOptional()
  @IsBoolean()
  acceptsEntries?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsAllocations?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsBudget?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showInCashFlow?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showInIncomeStatement?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showInManagementBalance?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showInReports?: boolean;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: 'wallet' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({
    enum: StructureStatus,
    default: StructureStatus.ACTIVE,
    description:
      'Ciclo de vida da estrutura: rascunho, ativo, inativo ou arquivado.',
  })
  @IsOptional()
  @IsEnum(StructureStatus)
  structureStatus?: StructureStatus;
}

export class UpdateAccountPlanDto extends PartialType(
  OmitType(CreateAccountPlanDto, [
    'organizationId',
    'companyId',
    'autoGenerateCode',
  ] as const),
) {}
