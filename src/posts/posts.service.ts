import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { Repository } from 'typeorm';
import type { PostKind, PostPrivacy } from './posts.types';
import { PostEntity } from './post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
  ) {}

  async getById(params: { id: string; currentUserId?: string }) {
    const id = params.id.trim();
    if (!id) throw new NotFoundException('post not found');

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .where('p.id = :id', { id });

    if (params.currentUserId) {
      qb.addSelect(
        `(SELECT verdict FROM swipes WHERE "userId" = :currentUserId AND "postId" = "p"."id" LIMIT 1)`,
        'myVerdict',
      )
        .addSelect(
          `(EXISTS (SELECT 1 FROM reposts r2 WHERE r2."userId" = :currentUserId AND r2."postId" = "p"."id"))`,
          'isReposted',
        )
        .setParameter('currentUserId', params.currentUserId);
    }

    const { entities, raw } = await qb.getRawAndEntities();
    const post = entities[0];
    const extra = raw[0];

    if (!post) throw new NotFoundException('post not found');

    return {
      id: post.id,
      kind: post.kind,
      creatorId: post.creatorId,
      creatorDisplayName: post.creator?.displayName ?? post.creator?.username ?? null,
      creatorAvatarUrl: post.creator?.avatarUrl ?? null,
      description: post.description,
      hashtags: post.hashtags ?? [],
      privacy: post.privacy,
      dopeCount: post.dopeCount ?? 0,
      nopeCount: post.nopeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      repostCount: post.repostCount ?? 0,
      myVerdict: extra?.myVerdict ?? undefined,
      isReposted:
        extra?.isReposted === true || extra?.isReposted === 'true'
          ? true
          : extra?.isReposted === false || extra?.isReposted === 'false'
            ? false
            : undefined,
      trackTitle: post.trackTitle ?? undefined,
      trackId: post.trackId ?? undefined,
      trackArtist: post.trackArtist ?? undefined,
      trackArtworkUrl: post.trackArtworkUrl ?? undefined,
      trackPreviewUrl: post.trackPreviewUrl ?? undefined,
      trackDurationMs: post.trackDurationMs ?? undefined,
      videoUrl: post.videoUrl ?? undefined,
      imageUrls: post.imageUrls ?? undefined,
      coverUrl: post.coverUrl ?? undefined,
      createdAt: post.createdAt.toISOString(),
    };
  }

  async create(params: {
    creatorId: string;
    creatorDisplayName?: string;
    creatorAvatarUrl?: string;
    kind: PostKind;
    description?: string;
    hashtags?: string[];
    privacy?: PostPrivacy;
    trackTitle?: string;
    trackId?: string;
    trackArtist?: string;
    trackArtworkUrl?: string;
    trackPreviewUrl?: string;
    trackDurationMs?: number;
    videoUrl?: string;
    imageUrls?: string[];
    coverUrl?: string;
  }) {
    if (params.kind === 'video' && !params.videoUrl) {
      throw new BadRequestException('video is required for video posts');
    }
    if (params.kind === 'photo' && (!params.imageUrls || params.imageUrls.length === 0)) {
      throw new BadRequestException('photos are required for photo posts');
    }

    const entity = await this.postsRepo.save(
      this.postsRepo.create({
        id: randomUUID(),
        kind: params.kind,
        creatorId: params.creatorId,
        description: params.description ?? '',
        hashtags: params.hashtags ?? [],
        privacy: params.privacy ?? 'everyone',
        trackTitle: params.trackTitle ?? null,
        trackId: params.trackId ?? null,
        trackArtist: params.trackArtist ?? null,
        trackArtworkUrl: params.trackArtworkUrl ?? null,
        trackPreviewUrl: params.trackPreviewUrl ?? null,
        trackDurationMs: params.trackDurationMs ?? null,
        videoUrl: params.videoUrl ?? null,
        imageUrls: params.imageUrls ?? null,
        coverUrl: params.coverUrl ?? null,
      }),
    );

    return {
      id: entity.id,
      kind: entity.kind,
      creatorId: entity.creatorId,
      description: entity.description,
      hashtags: entity.hashtags ?? [],
      privacy: entity.privacy,
      trackTitle: entity.trackTitle ?? undefined,
      trackId: entity.trackId ?? undefined,
      trackArtist: entity.trackArtist ?? undefined,
      trackArtworkUrl: entity.trackArtworkUrl ?? undefined,
      trackPreviewUrl: entity.trackPreviewUrl ?? undefined,
      trackDurationMs: entity.trackDurationMs ?? undefined,
      videoUrl: entity.videoUrl ?? undefined,
      imageUrls: entity.imageUrls ?? undefined,
      coverUrl: entity.coverUrl ?? undefined,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  async list() {
    const items = await this.postsRepo.find({ order: { createdAt: 'DESC' } });
    return {
      items: items.map((p) => ({
        id: p.id,
        kind: p.kind,
        creatorId: p.creatorId,
        description: p.description,
        hashtags: p.hashtags ?? [],
        privacy: p.privacy,
        trackTitle: p.trackTitle ?? undefined,
        trackId: p.trackId ?? undefined,
        trackArtist: p.trackArtist ?? undefined,
        trackArtworkUrl: p.trackArtworkUrl ?? undefined,
        trackPreviewUrl: p.trackPreviewUrl ?? undefined,
        trackDurationMs: p.trackDurationMs ?? undefined,
        videoUrl: p.videoUrl ?? undefined,
        imageUrls: p.imageUrls ?? undefined,
        coverUrl: p.coverUrl ?? undefined,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }
}
