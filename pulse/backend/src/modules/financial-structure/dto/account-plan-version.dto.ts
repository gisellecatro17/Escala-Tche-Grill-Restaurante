import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { AccountPlanKind, AccountPlanVersionStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Versão do plano de contas (seções 14 e 68). */
export class CreateAccountPlanVersionDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Ausente = versão compartilhada por toda a organização.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Plano Gerencial 2027' })
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da versão.' })
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: AccountPlanKind,
    default: AccountPlanKind.MANAGEMENT,
  })
  @IsOptional()
  @IsEnum(AccountPlanKind)
  planType?: AccountPlanKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Versão da qual esta deriva, para manter a cadeia de histórico.',
  })
  @IsOptional()
  @IsUUID()
  previousVersionId?: string;

  @ApiPropertyOptional({ enum: AccountPlanVersionStatus })
  @IsOptional()
  @IsEnum(AccountPlanVersionStatus)
  status?: AccountPlanVersionStatus;
}

export class UpdateAccountPlanVersionDto extends PartialType(
  OmitType(CreateAccountPlanVersionDto, [
    'organizationId',
    'companyId',
  ] as const),
) {}

/** Ativa uma versão, substituindo a que estiver ativa no mesmo escopo. */
export class ActivateVersionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da ativação.' })
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Copia as contas da versão anterior para a nova versão ao ativá-la.',
  })
  @IsOptional()
  copyAccountsFromPrevious?: boolean;
}
