import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { PaymentMethod, RecordStatus } from '@prisma/client';
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
} from 'class-validator';

/**
 * Categoria financeira. Mantém os campos originais (`companyId`, `name`,
 * `parentCategoryId`) para não quebrar o cadastro rápido usado por Fornecedores e
 * Clientes, e acrescenta a estrutura completa exigida pelo módulo de estrutura financeira.
 */
export class CreateCategoryDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da categoria.' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description:
      'Informe para criar uma subcategoria de outra categoria já existente. A hierarquia não tem limite de profundidade.',
  })
  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @ApiPropertyOptional({ example: 'CAT-ENERGIA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: 'zap' })
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

  // ── Dimensões estruturais ──
  @ApiPropertyOptional({ description: 'Conta do plano de contas vinculada.' })
  @IsOptional()
  @IsUUID()
  accountPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  financialNatureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultResultCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultProjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultBusinessUnitId?: string;

  // ── Regras automáticas ──
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultSupplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultCustomerId?: string;

  @ApiPropertyOptional({
    description:
      'Conta bancária padrão. Referência lógica — o cadastro de contas bancárias da empresa ainda não existe.',
  })
  @IsOptional()
  @IsUUID()
  defaultBankAccountId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  defaultPaymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Conta gerencial (texto livre).' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  managementAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultHistory?: string;

  @ApiPropertyOptional({
    description: 'Rateio padrão aplicado a esta categoria.',
  })
  @IsOptional()
  @IsUUID()
  defaultAllocationRuleId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoClassificationEnabled?: boolean;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class UpdateCategoryDto extends PartialType(
  OmitType(CreateCategoryDto, ['companyId'] as const),
) {}
