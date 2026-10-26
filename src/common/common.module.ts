import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CsrfGuard, JwtAuthGuard, RolesGuard } from './guards';

@Global()
@Module({
  imports: [JwtModule.registerAsync({ global: true, inject: [ConfigService], useFactory: (c: ConfigService) => ({ secret: c.getOrThrow<string>('AUTH_SECRET'), signOptions: { expiresIn: '15m' } }) })],
  providers: [JwtAuthGuard, RolesGuard, CsrfGuard],
  exports: [JwtAuthGuard, RolesGuard, CsrfGuard],
})
export class CommonModule {}
