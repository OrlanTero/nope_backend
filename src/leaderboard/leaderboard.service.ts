import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PostEntity } from '../posts/post.entity';
import { UserEntity } from '../auth/user.entity';

@Injectable()
export class LeaderboardService {
  private readonly cacheTtlMs = 30_000;
  private readonly cache = new Map<string, { expiresAt: number; value: any }>();

  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  private getCached<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  private setCached<T>(key: string, value: T) {
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, value });
    return value;
  }

  async topPosts(params: { offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 15));

    const cacheKey = `topPosts:${offset}:${limit}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'creator')
      .addSelect(
        '(COALESCE(p.dopeCount, 0)::float / GREATEST(1, COALESCE(p.dopeCount, 0) + COALESCE(p.nopeCount, 0)))',
        'vibescore',
      )
      .orderBy('vibescore', 'DESC')
      .addOrderBy('p.dopeCount', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const { entities, raw } = await qb.getRawAndEntities();

    const vibeScores = raw.map((r) => Number(r?.vibescore ?? 0));

    return this.setCached(cacheKey, {
      items: entities.map((p, i) => ({
        id: p.id,
        kind: p.kind,
        description: p.description,
        thumbnailUrl: p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '',
        creatorId: p.creatorId,
        creatorDisplayName: p.creator?.displayName ?? p.creator?.username ?? null,
        dopeCount: p.dopeCount ?? 0,
        nopeCount: p.nopeCount ?? 0,
        vibeScore: vibeScores[i] ?? 0,
        commentCount: p.commentCount ?? 0,
        repostCount: p.repostCount ?? 0,
        createdAt: p.createdAt.toISOString(),
      })),
      offset,
      limit,
    });
  }

  async topHashtags(params: { offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 20));

    const cacheKey = `topHashtags:${offset}:${limit}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const rows = (await this.postsRepo.query(
      [
        'SELECT h.tag AS tag, COUNT(*)::int AS count',
        'FROM posts p',
        'JOIN LATERAL unnest(p.hashtags) AS h(tag) ON TRUE',
        'GROUP BY h.tag',
        'ORDER BY count DESC',
        'OFFSET $1',
        'LIMIT $2',
      ].join(' '),
      [offset, limit],
    )) as Array<{ tag: string; count: number }>;

    return this.setCached(cacheKey, {
      items: rows.map((r) => ({
        tag: r.tag.startsWith('#') ? r.tag : `#${r.tag}`,
        count: Number(r.count) || 0,
      })),
      offset,
      limit,
    });
  }

  async topUsers(params: { offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const cacheKey = `topUsers:${offset}:${limit}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const users = await this.usersRepo.find({
      order: {
        followerCount: 'DESC',
      },
      skip: offset,
      take: limit,
    });

    return this.setCached(cacheKey, {
      items: users.map((u) => ({
        id: u.id,
        username: u.username ?? null,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        followerCount: u.followerCount ?? 0,
        followingCount: u.followingCount ?? 0,
        dopeCount: u.dopeCount ?? 0,
        repostCount: u.repostCount ?? 0,
        commentCount: u.commentCount ?? 0,
      })),
      offset,
      limit,
    });
  }
}
