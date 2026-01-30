import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarkSeenDto } from './dto/mark-seen.dto';
import { NotificationsService } from './notifications.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  summary(@Req() req: AuthedRequest) {
    return this.notificationsService.summary({ userId: req.user.userId });
  }

  @UseGuards(JwtAuthGuard)
  @Post('mark-seen')
  markSeen(@Req() req: AuthedRequest, @Body() dto: MarkSeenDto) {
    return this.notificationsService.markSeen({ userId: req.user.userId, type: dto.type });
  }
}
