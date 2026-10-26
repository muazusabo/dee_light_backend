import { BadRequestException, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { MAX_IMAGE_BYTES, UploadsService } from './uploads.service';

export const imageInterceptor = () => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

@ApiTags('uploads') @Controller('uploads') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
export class UploadsController {
  constructor(private uploads: UploadsService) {}
  @Post('images') @ApiConsumes('multipart/form-data') @Throttle({ default: { limit: 30, ttl: 60_000 } }) @UseInterceptors(imageInterceptor())
  upload(@UploadedFile() file: Express.Multer.File, @Query('folder') folder: string) {
    if (!['products', 'categories', 'branding'].includes(folder)) throw new BadRequestException('folder must be products, categories or branding');
    return this.uploads.putPublic(folder as 'products', file);
  }
}
