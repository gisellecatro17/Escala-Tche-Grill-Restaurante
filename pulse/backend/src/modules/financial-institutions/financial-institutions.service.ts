import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinancialInstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.financialInstitution.findMany({
      where: {
        status: 'ACTIVE',
        ...(search
          ? {
              OR: [
                { legalName: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
                { compeCode: { contains: search } },
                { ispb: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { legalName: 'asc' },
      take: 50,
    });
  }
}
