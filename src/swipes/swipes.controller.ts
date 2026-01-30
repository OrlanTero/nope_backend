import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSwipeDto } from './dto/create-swipe.dto';
import { SwipesService } from './swipes.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('swipes')
export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSwipeDto) {
    return this.swipesService.createSwipe(
      req.user.userId,
      dto.trackId,
      dto.verdict,
    );
  }
}
