import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, search?: string) {
    return this.prisma.costCenter.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  create(dto: CreateCostCenterDto) {
    return this.prisma.costCenter.create({
      data: { companyId: dto.companyId, name: dto.name },
    });
  }
}
