import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { AccountKind, AccountPlanType, RecordStatus } from '@prisma/client';
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

  @ApiProperty({ example: '1.1.01' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o código da conta.' })
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Caixa' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a descrição da conta.' })
  @MaxLength(255)
  name: string;

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
}

export class UpdateAccountPlanDto extends PartialType(
  OmitType(CreateAccountPlanDto, ['organizationId', 'companyId'] as const),
) {}
