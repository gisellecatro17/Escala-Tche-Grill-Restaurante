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
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  assertCompanyPermission,
  assertOrganizationPermission,
  hasPermissionAnywhere,
} from '../../common/utils/access-control.util';
import { CreateCompanyLinkDto } from './dto/create-company-link.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { DocumentQuerySupplierDto } from './dto/document-query-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { SaveDraftSupplierDto } from './dto/save-draft-supplier.dto';
import { SupplierBankAccountDto } from './dto/supplier-bank-account.dto';
import { SupplierPixKeyDto } from './dto/supplier-pix-key.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierCompanyLinksService } from './supplier-company-links.service';
import { SuppliersService } from './suppliers.service';

@ApiTags('Fornecedores')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly linksService: SupplierCompanyLinksService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os fornecedores vinculados às empresas visíveis ao usuário.',
  })
  findAll(
    @Query() query: QuerySuppliersDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.suppliersService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta o cadastro global de um fornecedor.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.suppliersService.findOne(id, actor);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Lista os documentos anexados ao fornecedor.' })
  listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.listDocuments(id);
  }

  @Post()
  @ApiMessage('Fornecedor incluído com sucesso.')
  @ApiOperation({
    summary:
      'Inclui o cadastro global de um fornecedor (opcionalmente já com o vínculo com uma empresa).',
  })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() actor: RequestUser) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'supplier.create',
      'Você não tem permissão para incluir fornecedores nesta organização.',
    );
    return this.suppliersService.create(dto, actor);
  }

  @Post('drafts')
  @ApiMessage('Rascunho salvo com sucesso.')
  @ApiOperation({
    summary: 'Cria ou atualiza um rascunho do cadastro de fornecedor.',
  })
  saveDraft(
    @Body() dto: SaveDraftSupplierDto & { id?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'supplier.create',
      'Você não tem permissão para incluir fornecedores nesta organização.',
    );
    return this.suppliersService.saveDraft(dto, actor);
  }

  @Post('document-query')
  @ApiOperation({
    summary:
      'Consulta dados cadastrais de um CPF/CNPJ (reaproveita o provider do Cadastro de Empresas).',
  })
  queryDocument(
    @Body() dto: DocumentQuerySupplierDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!hasPermissionAnywhere(actor, 'supplier.query_document')) {
      throw new ForbiddenException(
        'Você não tem permissão para consultar dados cadastrais.',
      );
    }
    return this.suppliersService.queryDocument(dto, actor, dto.organizationId);
  }

  @Patch(':id')
  @ApiMessage('Fornecedor atualizado com sucesso.')
  @ApiOperation({
    summary: 'Atualiza os dados cadastrais globais do fornecedor.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.update');
    return this.suppliersService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @ApiMessage('Fornecedor ativado com sucesso.')
  @ApiOperation({ summary: 'Ativa o cadastro global do fornecedor.' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.activate');
    return this.suppliersService.activate(id, actor);
  }

  @Post(':id/company-links')
  @ApiMessage('Fornecedor vinculado à empresa com sucesso.')
  @ApiOperation({
    summary: 'Vincula um fornecedor já existente a uma empresa.',
  })
  createLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompanyLinkDto,
    @CurrentUser() actor: RequestUser,
  ) {
    assertCompanyPermission(
      actor,
      dto.companyId,
      'supplier.manage_company_link',
    );
    return this.linksService.createLink(id, dto, actor);
  }

  @Post(':id/bank-accounts')
  @ApiMessage('Dados bancários incluídos com sucesso.')
  @ApiOperation({ summary: 'Inclui uma conta bancária do fornecedor.' })
  addBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplierBankAccountDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_bank_data');
    return this.suppliersService.addBankAccount(id, dto, actor);
  }

  @Patch(':id/bank-accounts/:bankAccountId')
  @ApiMessage('Conta bancária atualizada com sucesso.')
  @ApiOperation({ summary: 'Edita uma conta bancária do fornecedor.' })
  updateBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bankAccountId', ParseUUIDPipe) bankAccountId: string,
    @Body() dto: Partial<SupplierBankAccountDto>,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_bank_data');
    return this.suppliersService.updateBankAccount(
      id,
      bankAccountId,
      dto,
      actor,
    );
  }

  @Post(':id/bank-accounts/:bankAccountId/deactivate')
  @ApiMessage('Conta bancária inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma conta bancária do fornecedor.' })
  deactivateBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bankAccountId', ParseUUIDPipe) bankAccountId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_bank_data');
    return this.suppliersService.deactivateBankAccount(
      id,
      bankAccountId,
      actor,
    );
  }

  @Post(':id/pix-keys')
  @ApiMessage('Chave PIX incluída com sucesso.')
  @ApiOperation({ summary: 'Inclui uma chave PIX do fornecedor.' })
  addPixKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplierPixKeyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_pix_keys');
    return this.suppliersService.addPixKey(id, dto, actor);
  }

  @Patch(':id/pix-keys/:pixKeyId')
  @ApiMessage('Chave PIX atualizada com sucesso.')
  @ApiOperation({ summary: 'Edita uma chave PIX do fornecedor.' })
  updatePixKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pixKeyId', ParseUUIDPipe) pixKeyId: string,
    @Body() dto: Partial<SupplierPixKeyDto>,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_pix_keys');
    return this.suppliersService.updatePixKey(id, pixKeyId, dto, actor);
  }

  @Post(':id/pix-keys/:pixKeyId/deactivate')
  @ApiMessage('Chave PIX inativada com sucesso.')
  @ApiOperation({ summary: 'Inativa uma chave PIX do fornecedor.' })
  deactivatePixKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pixKeyId', ParseUUIDPipe) pixKeyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_pix_keys');
    return this.suppliersService.deactivatePixKey(id, pixKeyId, actor);
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @ApiMessage('Documento anexado com sucesso.')
  @ApiOperation({
    summary: 'Anexa um documento ao fornecedor (Supabase Storage).',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.manage_documents');
    if (!file) {
      throw new ForbiddenException('Envie um arquivo de documento.');
    }
    return this.suppliersService.uploadDocument(id, file, documentType, actor);
  }

  @Delete(':id')
  @ApiMessage('Fornecedor excluído com sucesso.')
  @ApiOperation({
    summary:
      'Exclui o cadastro global do fornecedor (somente rascunho sem vínculos).',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'supplier.delete');
    return this.suppliersService.remove(id, actor);
  }

  private assertAnyLinkPermission(actor: RequestUser, permissionSlug: string) {
    if (!hasPermissionAnywhere(actor, permissionSlug)) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar esta ação.',
      );
    }
  }
}
