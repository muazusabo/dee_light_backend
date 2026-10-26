import { Global, Module } from '@nestjs/common';
import { VariantsService } from './variants.service';
@Global() @Module({ providers: [VariantsService], exports: [VariantsService] })
export class VariantsModule {}
