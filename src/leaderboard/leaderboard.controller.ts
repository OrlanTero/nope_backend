import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListProfilePostsDto } from '../social/dto/list-profile-posts.dto';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('posts')
  posts(@Query() q: ListProfilePostsDto) {
    return this.leaderboardService.topPosts({ offset: q.offset, limit: q.limit });
  }

  @Get('hashtags')
  hashtags(@Query() q: ListProfilePostsDto) {
    return this.leaderboardService.topHashtags({ offset: q.offset, limit: q.limit });
  }

  @Get('users')
  users(@Query() q: ListProfilePostsDto) {
    return this.leaderboardService.topUsers({ offset: q.offset, limit: q.limit });
  }
}
