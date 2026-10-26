import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get() async check() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ok', database: 'up', uptime: Math.round(process.uptime()) }; }
    catch { throw new ServiceUnavailableException('Database unavailable'); }
  }
}
