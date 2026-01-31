import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PostEntity } from '../posts/post.entity';
import { SwipeEntity } from '../swipes/swipe.entity';
import { FeedTrack } from './feed.types';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
  ) {}

  private toFeedTrack(p: PostEntity, displayName?: string, avatarUrl?: string | null, raw?: any): FeedTrack {
    const imageUrl = p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '';
    return {
      id: p.id,
      type: p.kind === 'video' ? 'video' : 'photo',
      imageUrl,
      imageUrls: p.imageUrls ?? undefined,
      videoUrl: p.videoUrl ?? undefined,
      coverUrl: p.coverUrl ?? undefined,
      trackTitle: p.trackTitle ?? undefined,
      trackId: p.trackId ?? undefined,
      trackArtist: p.trackArtist ?? undefined,
      trackArtworkUrl: p.trackArtworkUrl ?? undefined,
      trackPreviewUrl: p.trackPreviewUrl ?? undefined,
      trackDurationMs: p.trackDurationMs ?? undefined,
      creatorId: p.creatorId,
      creatorDisplayName: displayName,
      creatorAvatarUrl: avatarUrl ?? undefined,
      repostedById: raw?.repostedById ?? undefined,
      repostedByDisplayName: raw?.repostedByDisplayName ?? undefined,
      repostedByAvatarUrl: raw?.repostedByAvatarUrl ?? undefined,
      isReposted: raw?.isReposted === true || raw?.isReposted === 'true' ? true : raw?.isReposted === false || raw?.isReposted === 'false' ? false : undefined,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
      myVerdict: raw?.myVerdict,
      dopeCount: Number(raw?.dopeCount ?? 0),
      nopeCount: Number(raw?.nopeCount ?? 0),
      commentCount: Number(raw?.commentCount ?? 0),
    };
  }

  async getTrending(currentUserId?: string, page?: { offset?: number; limit?: number }) {
    const offset = Math.max(0, page?.offset ?? 0);
    const limit = Math.min(200, Math.max(1, page?.limit ?? 30));

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .leftJoin(SwipeEntity, 's', 's.postId = p.id')
      .addSelect(
        "COALESCE(SUM(CASE WHEN s.verdict = 'DOPE' THEN 1 WHEN s.verdict = 'NOPE' THEN -1 ELSE 0 END), 0)",
        'score',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN s.verdict = 'DOPE' THEN 1 ELSE 0 END), 0)",
        'dopeCount',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN s.verdict = 'NOPE' THEN 1 ELSE 0 END), 0)",
        'nopeCount',
      )
      .addSelect(
        `(
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c."targetType" = 'post'
            AND c."targetId" = ("p"."id")::text
            AND c."isDeleted" = false
        )`,
        'commentCount',
      );

    if (currentUserId) {
      qb.addSelect(
        `(EXISTS (SELECT 1 FROM swipes s0 WHERE s0."userId" = :currentUserId AND s0."postId" = "p"."id"))`,
        'isInteracted',
      );
      qb.addSelect(
        `(SELECT verdict FROM swipes WHERE "userId" = :currentUserId AND "postId" = "p"."id" LIMIT 1)`,
        'myVerdict',
      ).setParameter('currentUserId', currentUserId);
    }

    qb.groupBy('p.id').addGroupBy('u.id');

    if (currentUserId) {
      qb.orderBy('"isInteracted"', 'ASC');
    }

    qb.addOrderBy('score', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    return {
      items: entities.map((p, i) =>
        this.toFeedTrack(
          p,
          p.creator?.displayName ?? p.creator?.username ?? undefined,
          p.creator?.avatarUrl ?? null,
          raw[i],
        ),
      ),
      offset,
      limit,
    };
  }

  async getFollowing(currentUserId?: string, page?: { offset?: number; limit?: number }) {
    if (!currentUserId) {
      return { items: [] };
    }

    const offset = Math.max(0, page?.offset ?? 0);
    const limit = Math.min(200, Math.max(1, page?.limit ?? 30));

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .leftJoin(SwipeEntity, 's', 's.postId = p.id')
      .where(
        `(
          "p"."creatorId" IN (SELECT "followingId" FROM follows f WHERE f."followerId" = :currentUserId)
          OR EXISTS (
            SELECT 1
            FROM reposts r
            WHERE r."postId" = "p"."id"
              AND r."userId" IN (SELECT "followingId" FROM follows f2 WHERE f2."followerId" = :currentUserId)
          )
        )`,
      )
      .addSelect(
        `(
          COALESCE(
            (
              SELECT r."createdAt"
              FROM reposts r
              WHERE r."postId" = "p"."id"
                AND r."userId" IN (SELECT "followingId" FROM follows f0 WHERE f0."followerId" = :currentUserId)
              ORDER BY r."createdAt" DESC
              LIMIT 1
            ),
            "p"."createdAt"
          )
        )`,
        'activityAt',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN s.verdict = 'DOPE' THEN 1 ELSE 0 END), 0)",
        'dopeCount',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN s.verdict = 'NOPE' THEN 1 ELSE 0 END), 0)",
        'nopeCount',
      )
      .addSelect(
        `(
          SELECT r."userId"
          FROM reposts r
          WHERE r."postId" = "p"."id"
            AND r."userId" IN (SELECT "followingId" FROM follows f3 WHERE f3."followerId" = :currentUserId)
          ORDER BY r."createdAt" DESC
          LIMIT 1
        )`,
        'repostedById',
      )
      .addSelect(
        `(
          SELECT COALESCE(u2."displayName", u2."username", u2."email")
          FROM reposts r
          JOIN users u2 ON u2."id" = r."userId"
          WHERE r."postId" = "p"."id"
            AND r."userId" IN (SELECT "followingId" FROM follows f4 WHERE f4."followerId" = :currentUserId)
          ORDER BY r."createdAt" DESC
          LIMIT 1
        )`,
        'repostedByDisplayName',
      )
      .addSelect(
        `(
          SELECT u2."avatarUrl"
          FROM reposts r
          JOIN users u2 ON u2."id" = r."userId"
          WHERE r."postId" = "p"."id"
            AND r."userId" IN (SELECT "followingId" FROM follows f5 WHERE f5."followerId" = :currentUserId)
          ORDER BY r."createdAt" DESC
          LIMIT 1
        )`,
        'repostedByAvatarUrl',
      )
      .addSelect(
        `(EXISTS (SELECT 1 FROM reposts r2 WHERE r2."userId" = :currentUserId AND r2."postId" = "p"."id"))`,
        'isReposted',
      )
      .addSelect(
        `(
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c."targetType" = 'post'
            AND c."targetId" = ("p"."id")::text
            AND c."isDeleted" = false
        )`,
        'commentCount',
      );

    qb.addSelect(
      `(EXISTS (SELECT 1 FROM swipes s0 WHERE s0."userId" = :currentUserId AND s0."postId" = "p"."id"))`,
      'isInteracted',
    );

    qb.addSelect(
      `(SELECT verdict FROM swipes WHERE "userId" = :currentUserId AND "postId" = "p"."id" LIMIT 1)`,
      'myVerdict',
    ).setParameter('currentUserId', currentUserId);

    qb.groupBy('p.id')
      .addGroupBy('u.id')
      .orderBy('"isInteracted"', 'ASC')
      .addOrderBy('"activityAt"', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    return {
      items: entities.map((p, i) =>
        this.toFeedTrack(
          p,
          p.creator?.displayName ?? p.creator?.username ?? undefined,
          p.creator?.avatarUrl ?? null,
          raw[i],
        ),
      ),
      offset,
      limit,
    };
  }

  async getFeed(currentUserId?: string) {
    return this.getTrending(currentUserId);
  }
}
