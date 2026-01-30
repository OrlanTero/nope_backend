import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GifsService } from './gifs.service';

@Controller('gifs')
export class GifsController {
  constructor(private readonly gifsService: GifsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('trending')
  trending() {
    return this.gifsService.trending();
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(@Query('q') q: string) {
    return this.gifsService.search({ q });
  }
}
