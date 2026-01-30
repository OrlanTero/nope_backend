import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('people')
  people(@Query() q: SearchDto) {
    return this.searchService.people({ q: q.q, offset: q.offset, limit: q.limit });
  }

  @Get('hashtags')
  hashtags(@Query() q: SearchDto) {
    return this.searchService.hashtags({ q: q.q, limit: q.limit });
  }

  @Get('posts')
  posts(@Query() q: SearchDto) {
    return this.searchService.posts({ q: q.q, offset: q.offset, limit: q.limit });
  }
}
