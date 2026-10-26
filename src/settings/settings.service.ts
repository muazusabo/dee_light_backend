import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}
  get(db: Prisma.TransactionClient | PrismaService = this.prisma) {
    return db.siteSetting.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  }
  async update(dto: UpdateSettingsDto) {
    const { socialLinks, deliveryFee, ...rest } = dto;
    // Only http(s) social links are kept.
    const links = socialLinks ? Object.fromEntries(Object.entries(socialLinks).filter(([, v]) => /^https?:\/\//.test(v))) : undefined;
    const data: Prisma.SiteSettingUpdateInput = { ...rest, ...(links ? { socialLinks: links } : {}), ...(deliveryFee !== undefined ? { deliveryFee: new Prisma.Decimal(deliveryFee.toFixed(2)) } : {}) };
    return this.prisma.siteSetting.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...(data as any) } });
  }
}
