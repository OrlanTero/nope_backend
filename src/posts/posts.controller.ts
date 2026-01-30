import {
  Body,
  Controller,
  Get,
  Post as HttpPost,
  Param,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { StorageService } from '../storage/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

type AuthedRequest = Request & { user: { userId: string; email: string } };

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Req() req: AuthedRequest, @Param('id') id: string) {
    const params = { id, currentUserId: req.user.userId };
    return this.postsService.getById(params);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
        { name: 'photos', maxCount: 10 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 1024 * 1024 * 150,
          files: 12,
        },
      },
    ),
  )
  create(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePostDto,
    @UploadedFiles()
    files: {
      video?: Express.Multer.File[];
      cover?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
  ) {
    return this.createImpl(req, dto, files);
  }

  private async createImpl(
    req: AuthedRequest,
    dto: CreatePostDto,
    files: {
      video?: Express.Multer.File[];
      cover?: Express.Multer.File[];
      photos?: Express.Multer.File[];
    },
  ) {

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const video = files?.video?.[0];
    const cover = files?.cover?.[0];
    const photos = files?.photos ?? [];

    const videoUrl = video
      ? await this.storageService.saveUploadedFile({
          file: video,
          baseUrl,
          prefix: 'posts/video',
        })
      : undefined;
    const coverUrl = cover
      ? await this.storageService.saveUploadedFile({
          file: cover,
          baseUrl,
          prefix: 'posts/cover',
        })
      : undefined;
    const imageUrls = photos.length
      ? await Promise.all(
          photos.map((p) =>
            this.storageService.saveUploadedFile({
              file: p,
              baseUrl,
              prefix: 'posts/photo',
            }),
          ),
        )
      : undefined;

    const finalCoverUrl = coverUrl ?? (dto.kind === 'photo' ? imageUrls?.[0] : undefined);

    const hashtags = (dto.hashtags ?? '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const me = await this.authService.me(req.user.userId);
    const displayName =
      (me.displayName as string | undefined) ??
      (me.username as string | undefined) ??
      (me.email as string | undefined) ??
      'NOPE User';

    const post = await this.postsService.create({
      creatorId: req.user.userId,
      creatorDisplayName: displayName,
      kind: dto.kind,
      description: dto.description ?? '',
      hashtags,
      privacy: dto.privacy ?? 'everyone',
      trackTitle: dto.trackTitle,
      trackId: dto.trackId,
      trackArtist: dto.trackArtist,
      trackArtworkUrl: dto.trackArtworkUrl,
      trackPreviewUrl: dto.trackPreviewUrl,
      trackDurationMs: dto.trackDurationMs != null ? Number(dto.trackDurationMs) : undefined,
      videoUrl,
      imageUrls,
      coverUrl: finalCoverUrl,
    });

    return post;
  }
}
