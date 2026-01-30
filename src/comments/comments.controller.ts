import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DopeCommentDto } from './dto/dope-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';
import { CommentsService } from './comments.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

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
    @Body() dto: CreateCommentDto,
    @UploadedFiles() files: { media?: Express.Multer.File[] },
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.commentsService.create({
      userId: req.user.userId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      parentId: dto.parentId,
      body: dto.body,
      gifUrl: dto.gifUrl,
      file: files?.media?.[0],
      baseUrl,
    });
  }

  @Get()
  async list(@Req() req: Request, @Query() q: ListCommentsDto) {
    const auth = (req as any).user as { userId: string } | undefined;
    return this.commentsService.list({
      userId: auth?.userId,
      targetType: q.targetType,
      targetId: q.targetId,
      offset: q.offset,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dope')
  async dope(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: DopeCommentDto) {
    return this.commentsService.toggleDope({
      userId: req.user.userId,
      commentId: id,
      on: dto?.on,
    });
  }
}
