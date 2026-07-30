import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corpo de inativação/arquivamento. O motivo é opcional, mas fica registrado na
 * auditoria — é o que explica meses depois por que um cadastro saiu do ar.
 */
export class DeactivateStructureDto {
  @ApiPropertyOptional({
    example: 'Centro encerrado após a reestruturação da operação.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
