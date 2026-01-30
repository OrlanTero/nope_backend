import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';

type AuthedAdminRequest = Request & { user: { adminId: string; email: string } };

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuthService.refresh(dto.refreshToken);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedAdminRequest) {
    return this.adminAuthService.me(req.user.adminId);
  }
}
