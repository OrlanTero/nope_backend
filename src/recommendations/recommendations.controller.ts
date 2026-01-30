import { Body, Controller, Get, Param, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { ListRecommendationsDto } from './dto/list-recommendations.dto';
import { RecommendationsService } from './recommendations.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'media', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024 * 30, files: 1 },
    }),
  )
  async create(
    @Req() req: AuthedRequest,
    @Body() dto: CreateRecommendationDto,
    @UploadedFiles() files: { media?: Express.Multer.File[] },
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.recommendationsService.create({
      userId: req.user.userId,
      body: dto.body,
      gifUrl: dto.gifUrl,
      file: files?.media?.[0],
      baseUrl,
    });
  }

  @Get()
  async list(@Query() q: ListRecommendationsDto) {
    return this.recommendationsService.list({
      beforeId: q.beforeId,
      limit: q.limit,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.recommendationsService.getById({ id });
  }
}
