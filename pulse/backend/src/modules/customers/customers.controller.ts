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
  assertOrganizationPermission,
  hasPermissionAnywhere,
} from '../../common/utils/access-control.util';
import { BankIdentifierDto } from './dto/bank-identifier.dto';
import { CreateCompanyLinkDto } from './dto/create-company-link.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerAddressDto } from './dto/customer-address.dto';
import { CustomerContactDto } from './dto/customer-contact.dto';
import { DocumentQueryCustomerDto } from './dto/document-query-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { SaveDraftCustomerDto } from './dto/save-draft-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerCompanyLinksService } from './customer-company-links.service';
import { CustomersService } from './customers.service';

@ApiTags('Clientes')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly linksService: CustomerCompanyLinksService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os clientes (e prospects) vinculados às empresas visíveis ao usuário.',
  })
  findAll(
    @Query() query: QueryCustomersDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.customersService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta o cadastro geral de um cliente.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.customersService.findOne(id, actor);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Lista os documentos anexados ao cliente.' })
  listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.listDocuments(id);
  }

  @Post()
  @ApiMessage('Cliente incluído com sucesso.')
  @ApiOperation({
    summary:
      'Inclui o cadastro geral de um cliente (opcionalmente já com o vínculo/prospect com uma empresa).',
  })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() actor: RequestUser) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'customer.create',
      'Você não tem permissão para incluir clientes nesta organização.',
    );
    return this.customersService.create(dto, actor);
  }

  @Post('drafts')
  @ApiMessage('Rascunho salvo com sucesso.')
  @ApiOperation({
    summary: 'Cria ou atualiza um rascunho do cadastro de cliente.',
  })
  saveDraft(
    @Body() dto: SaveDraftCustomerDto & { id?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    assertOrganizationPermission(
      actor,
      dto.organizationId,
      'customer.create',
      'Você não tem permissão para incluir clientes nesta organização.',
    );
    return this.customersService.saveDraft(dto, actor);
  }

  @Post('document-query')
  @ApiOperation({
    summary:
      'Consulta dados cadastrais de um CPF/CNPJ (reaproveita o provider do Cadastro de Empresas).',
  })
  queryDocument(
    @Body() dto: DocumentQueryCustomerDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!hasPermissionAnywhere(actor, 'customer.query_document')) {
      throw new ForbiddenException(
        'Você não tem permissão para consultar dados cadastrais.',
      );
    }
    return this.customersService.queryDocument(dto, actor, dto.organizationId);
  }

  @Patch(':id')
  @ApiMessage('Cliente atualizado com sucesso.')
  @ApiOperation({ summary: 'Atualiza os dados cadastrais gerais do cliente.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.update');
    return this.customersService.update(id, dto, actor);
  }

  @Post(':id/addresses')
  @ApiMessage('Endereço incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um endereço do cliente.' })
  addAddress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerAddressDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.update');
    return this.customersService.addAddress(id, dto, actor);
  }

  @Post(':id/contacts')
  @ApiMessage('Contato incluído com sucesso.')
  @ApiOperation({ summary: 'Inclui um contato do cliente.' })
  addContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerContactDto,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.update');
    return this.customersService.addContact(id, dto, actor);
  }

  @Post(':id/company-links')
  @ApiMessage('Cliente vinculado à empresa com sucesso.')
  @ApiOperation({
    summary: 'Vincula (como prospect) um cliente já existente a uma empresa.',
  })
  createLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCompanyLinkDto,
    @CurrentUser() actor: RequestUser,
  ) {
    if (!hasPermissionAnywhere(actor, 'customer.manage_company_link')) {
      throw new ForbiddenException(
        'Você não tem permissão para vincular clientes a esta empresa.',
      );
    }
    return this.linksService.createLink(id, dto, actor);
  }

  @Post(':id/bank-identifiers')
  @ApiMessage('Identificador incluído com sucesso.')
  @ApiOperation({
    summary:
      'Inclui um identificador para reconhecimento futuro de recebimentos.',
  })
  addBankIdentifier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BankIdentifierDto,
    @Query('companyId') companyId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.manage_company_link');
    return this.linksService.addBankIdentifier(id, companyId, dto, actor);
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @ApiMessage('Documento anexado com sucesso.')
  @ApiOperation({
    summary: 'Anexa um documento ao cliente (Supabase Storage).',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.manage_documents');
    if (!file) {
      throw new ForbiddenException('Envie um arquivo de documento.');
    }
    return this.customersService.uploadDocument(id, file, documentType, actor);
  }

  @Delete(':id')
  @ApiMessage('Cliente excluído com sucesso.')
  @ApiOperation({
    summary:
      'Exclui o cadastro geral do cliente (somente rascunho sem vínculos).',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    this.assertAnyLinkPermission(actor, 'customer.delete');
    return this.customersService.remove(id, actor);
  }

  private assertAnyLinkPermission(actor: RequestUser, permissionSlug: string) {
    if (!hasPermissionAnywhere(actor, permissionSlug)) {
      throw new ForbiddenException(
        'Você não tem permissão para realizar esta ação.',
      );
    }
  }
}
