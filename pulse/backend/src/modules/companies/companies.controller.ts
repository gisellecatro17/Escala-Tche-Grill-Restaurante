import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
  hasPermissionAnywhere,
} from '../../common/utils/access-control.util';
import { CompaniesService } from './companies.service';
import { ChangeCompanyStatusDto } from './dto/change-company-status.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DuplicateSettingsDto } from './dto/duplicate-settings.dto';
import { PostalCodeQueryDto } from './dto/postal-code-query.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { SaveDraftCompanyDto } from './dto/save-draft-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Empresas')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as empresas visíveis ao usuário autenticado.',
  })
  findAll(
    @Query() query: QueryCompaniesDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.companiesService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Consulta uma empresa pelo id, com endereços, contatos, CNAEs e histórico de status.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.view');
    return this.companiesService.findOne(id);
  }

  @Get(':id/activation-pendencies')
  @ApiOperation({
    summary: 'Lista as pendências que impedem a ativação da empresa.',
  })
  async activationPendencies(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.view');
    return this.companiesService.getActivationPendencies(id);
  }

  @Get(':id/audit')
  @ApiOperation({
    summary: 'Histórico de auditoria da empresa (somente leitura).',
  })
  async auditLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.view_audit');
    return this.companiesService.getAuditLog(id, query.page, query.perPage);
  }

  @Post()
  @ApiMessage('Empresa incluída com sucesso.')
  @ApiOperation({
    summary:
      'Inclui uma nova empresa em uma organização (conclui o cadastro em etapas).',
  })
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'company.create',
      'Você não tem permissão para incluir empresas nesta organização.',
    );
    return this.companiesService.create(dto, actor);
  }

  @Post('drafts')
  @ApiMessage('Rascunho salvo com sucesso.')
  @ApiOperation({
    summary:
      'Cria ou atualiza um rascunho do cadastro de empresa (permite retomar depois).',
  })
  async saveDraft(
    @Body() dto: SaveDraftCompanyDto & { id?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'company.create',
      'Você não tem permissão para incluir empresas nesta organização.',
    );
    return this.companiesService.saveDraft(dto, actor);
  }

  @Post('document-query')
  @ApiOperation({
    summary:
      'Consulta dados cadastrais de um CNPJ em um provider externo desacoplado.',
  })
  async queryDocument(
    @Body() dto: DocumentQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!hasPermissionAnywhere(actor, 'company.query_document')) {
      throw new ForbiddenException(
        'Você não tem permissão para consultar dados cadastrais.',
      );
    }
    return this.companiesService.queryDocument(dto, actor, dto.organizationId);
  }

  @Post('postal-code-query')
  @ApiOperation({
    summary: 'Consulta um CEP em um provider externo desacoplado.',
  })
  async queryPostalCode(
    @Body() dto: PostalCodeQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.companiesService.queryPostalCode(dto, actor);
  }

  @Patch(':id')
  @ApiMessage('Empresa atualizada com sucesso.')
  @ApiOperation({ summary: 'Atualiza os dados de uma empresa.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.update');
    return this.companiesService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Empresa ativada com sucesso.')
  @ApiOperation({
    summary: 'Ativa uma empresa (valida pendências mínimas antes de ativar).',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.activate');
    return this.companiesService.activate(id, actor);
  }

  @Post(':id/reactivate')
  @ApiMessage('Empresa reativada com sucesso.')
  @ApiOperation({ summary: 'Reativa uma empresa suspensa ou inativa.' })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.activate');
    return this.companiesService.reactivate(id, actor);
  }

  @Post(':id/deactivate')
  @ApiMessage('Empresa inativada com sucesso.')
  @ApiOperation({
    summary:
      'Inativa uma empresa (bloqueia novos lançamentos, mantém histórico).',
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCompanyStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.deactivate');
    return this.companiesService.deactivate(id, dto, actor);
  }

  @Post(':id/suspend')
  @ApiMessage('Empresa suspensa com sucesso.')
  @ApiOperation({
    summary: 'Suspende uma empresa (distinto de inativar — exige motivo).',
  })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCompanyStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.suspend');
    return this.companiesService.suspend(id, dto, actor);
  }

  @Delete(':id')
  @ApiMessage('Empresa excluída com sucesso.')
  @ApiOperation({
    summary: 'Exclui uma empresa (somente rascunhos sem vínculos).',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.delete');
    return this.companiesService.remove(id, actor);
  }

  @Post(':id/duplicate-settings')
  @ApiMessage('Solicitação de duplicação registrada.')
  @ApiOperation({
    summary:
      'Duplica configurações desta empresa para outra (itens ainda em desenvolvimento ficam identificados).',
  })
  async duplicateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateSettingsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.duplicate_settings');
    return this.companiesService.duplicateSettings(id, dto, actor);
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiMessage('Logo enviada com sucesso.')
  @ApiOperation({ summary: 'Envia (ou substitui) a logo da empresa.' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.manage_logo');

    if (!file) {
      throw new ForbiddenException(
        'Envie um arquivo de imagem (PNG, JPG ou WEBP).',
      );
    }

    return this.companiesService.uploadLogo(id, file, actor);
  }

  @Delete(':id/logo')
  @ApiMessage('Logo removida com sucesso.')
  @ApiOperation({ summary: 'Remove a logo da empresa.' })
  async removeLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(actor, id, 'company.manage_logo');
    return this.companiesService.removeLogo(id, actor);
  }
}
