import { Global, Module } from '@nestjs/common';
import { AdminSettingsController, SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
@Global() @Module({ controllers: [SettingsController, AdminSettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
