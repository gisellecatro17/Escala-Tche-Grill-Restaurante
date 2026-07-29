import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, search?: string) {
    return this.prisma.category.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentCategoryId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentCategoryId, companyId: dto.companyId },
      });
      if (!parent) {
        throw new NotFoundException('Categoria de origem não encontrada.');
      }
    }

    return this.prisma.category.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        parentCategoryId: dto.parentCategoryId,
      },
    });
  }
}
