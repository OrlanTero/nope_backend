import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlockDto } from './dto/block.dto';
import { FollowDto } from './dto/follow.dto';
import { ListProfilePostsDto } from './dto/list-profile-posts.dto';
import { MuteDto } from './dto/mute.dto';
import { ToggleSaveDto } from './dto/toggle-save.dto';
import { SocialService } from './social.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('profiles')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getProfile(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.socialService.getProfile({ viewerId: req.user.userId, userId: id });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/visit')
  visit(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.socialService.recordVisit({ visitorId: req.user.userId, visitedUserId: id });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: FollowDto) {
    return this.socialService.setFollow({ userId: req.user.userId, targetUserId: id, on: dto.on });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/block')
  block(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: BlockDto) {
    return this.socialService.setBlock({ userId: req.user.userId, targetUserId: id, on: dto.on });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mute')
  mute(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MuteDto) {
    return this.socialService.setMute({ userId: req.user.userId, targetUserId: id, on: dto.on });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/visits')
  visits(@Req() req: AuthedRequest, @Param('id') id: string, @Query('limit') limit?: string) {
    if (req.user.userId !== id) return { items: [] };
    return this.socialService.listRecentVisitors({ userId: id, limit: limit ? Number(limit) : undefined });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/followers')
  followers(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: ListProfilePostsDto) {
    return this.socialService.listFollowers({
      viewerId: req.user.userId,
      userId: id,
      offset: q.offset,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/following')
  following(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: ListProfilePostsDto) {
    return this.socialService.listFollowing({
      viewerId: req.user.userId,
      userId: id,
      offset: q.offset,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/posts')
  posts(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: ListProfilePostsDto) {
    return this.socialService.listProfilePosts({
      viewerId: req.user.userId,
      userId: id,
      offset: q.offset,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/reposts')
  reposts(@Req() req: AuthedRequest, @Param('id') id: string, @Query() q: ListProfilePostsDto) {
    return this.socialService.listReposts({
      viewerId: req.user.userId,
      userId: id,
      offset: q.offset,
      limit: q.limit,
    });
  }
}

@Controller('saved')
export class SavedController {
  constructor(private readonly socialService: SocialService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: AuthedRequest, @Query() q: ListProfilePostsDto) {
    return this.socialService.listSaved({ userId: req.user.userId, offset: q.offset, limit: q.limit });
  }

  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  toggle(@Req() req: AuthedRequest, @Body() dto: ToggleSaveDto) {
    return this.socialService.toggleSave({ userId: req.user.userId, postId: dto.postId });
  }
}
