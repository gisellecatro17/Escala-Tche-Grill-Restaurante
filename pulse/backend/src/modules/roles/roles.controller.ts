import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Perfis e permissões')
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Lista os perfis disponíveis no Pulse.' })
  findAllRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('permissions')
  @ApiOperation({
    summary: 'Lista as permissões granulares disponíveis no Pulse.',
  })
  findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
    });
  }
}
