import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToggleRepostDto } from './dto/toggle-repost.dto';
import { SocialService } from './social.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('reposts')
export class RepostsController {
  constructor(private readonly socialService: SocialService) {}

  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  toggle(@Req() req: AuthedRequest, @Body() dto: ToggleRepostDto) {
    return this.socialService.toggleRepost({ userId: req.user.userId, postId: dto.postId });
  }
}
