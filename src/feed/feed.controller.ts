import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedService } from './feed.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getFeed(@Req() req: AuthedRequest) {
    return this.feedService.getFeed(req.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('trending')
  trending(@Req() req: AuthedRequest, @Query('offset') offset?: string, @Query('limit') limit?: string) {
    return this.feedService.getTrending(req.user?.userId, {
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('vibes')
  vibes(@Req() req: AuthedRequest, @Query('offset') offset?: string, @Query('limit') limit?: string) {
    return this.feedService.getTrending(req.user?.userId, {
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('following')
  following(@Req() req: AuthedRequest, @Query('offset') offset?: string, @Query('limit') limit?: string) {
    return this.feedService.getFollowing(req.user?.userId, {
      offset: offset ? Number(offset) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
