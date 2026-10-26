import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { UpdateSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings') @Controller('settings')
export class SettingsController {
  constructor(private s: SettingsService) {}
  @Get() get() { return this.s.get(); }
}
@ApiTags('admin') @Controller('admin/settings') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class AdminSettingsController {
  constructor(private s: SettingsService) {}
  @Put() update(@Body() dto: UpdateSettingsDto) { return this.s.update(dto); }
}
