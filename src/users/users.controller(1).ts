import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';
import { AddressDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users') @Controller('users/me') @UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}
  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) { return this.users.updateProfile(u.id, dto); }
  @Get('addresses') addresses(@CurrentUser() u: AuthUser) { return this.users.addresses(u.id); }
  @Post('addresses') add(@CurrentUser() u: AuthUser, @Body() dto: AddressDto) { return this.users.addAddress(u.id, dto); }
  @Delete('addresses/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.users.removeAddress(u.id, id); }
}
