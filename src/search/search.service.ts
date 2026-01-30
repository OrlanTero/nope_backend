import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ILike } from 'typeorm';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
  ) {}

  async people(params: { q: string; offset?: number; limit?: number }) {
    const q = params.q.trim().toLowerCase();
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    const items = await this.usersRepo.find({
      where: [
        { username: ILike(`%${q}%`) },
        { displayName: ILike(`%${q}%`) },
        { email: ILike(`%${q}%`) },
      ],
      order: { displayName: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username ?? null,
        displayName: u.displayName ?? null,
      })),
      offset,
      limit,
    };
  }

  async hashtags(params: { q: string; limit?: number }) {
    const q = params.q.trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    const rows = (await this.postsRepo.query(
      [
        'SELECT h.tag AS tag, COUNT(*)::int AS count',
        'FROM posts p',
        'JOIN LATERAL unnest(p.hashtags) AS h(tag) ON TRUE',
        'WHERE LOWER(h.tag) LIKE $1',
        'GROUP BY h.tag',
        'ORDER BY count DESC',
        'LIMIT $2',
      ].join(' '),
      [`%${q}%`, limit],
    )) as Array<{ tag: string; count: number }>;

    return {
      items: rows.map((r) => ({
        tag: r.tag.startsWith('#') ? r.tag : `#${r.tag}`,
        count: Number(r.count) || 0,
      })),
      limit,
    };
  }

  async posts(params: { q: string; offset?: number; limit?: number }) {
    const q = params.q.trim().toLowerCase();
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    const qTagHash = q.startsWith('#') ? q : `#${q}`;
    const qTagNoHash = q.startsWith('#') ? q.substring(1) : q;

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .where('LOWER(p.description) LIKE :q', { q: `%${q}%` })
      .orWhere(
        '(:qTagHash = ANY(SELECT LOWER(x) FROM unnest(p.hashtags) x) OR :qTagNoHash = ANY(SELECT LOWER(x) FROM unnest(p.hashtags) x))',
        {
          qTagHash,
          qTagNoHash,
        },
      )
      .orderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const posts = await qb.getMany();

    return {
      items: posts.map((p) => ({
        id: p.id,
        kind: p.kind,
        description: p.description,
        thumbnailUrl: p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '',
        creatorId: p.creatorId,
        creatorDisplayName: p.creator?.displayName ?? p.creator?.username ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      offset,
      limit,
    };
  }
}
