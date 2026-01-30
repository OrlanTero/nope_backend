import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { Repository } from 'typeorm';
import { PostEntity } from '../posts/post.entity';
import { UserEntity } from '../auth/user.entity';
import { SwipeEntity } from './swipe.entity';

@Injectable()
export class SwipesService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    @InjectRepository(SwipeEntity)
    private readonly swipesRepo: Repository<SwipeEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async createSwipe(userId: string, trackId: string, verdict: 'DOPE' | 'NOPE') {
    const post = await this.postsRepo.findOne({ where: { id: trackId } });
    if (!post) throw new NotFoundException('Post not found');

    await this.swipesRepo.manager.transaction(async (tx) => {
      const txSwipes = tx.getRepository(SwipeEntity);
      const txPosts = tx.getRepository(PostEntity);
      const txUsers = tx.getRepository(UserEntity);

      const existing = await txSwipes.findOne({ where: { userId, postId: trackId } });
      const prev = existing?.verdict;

      const applyDelta = async (v: 'DOPE' | 'NOPE', delta: number) => {
        if (v === 'DOPE') {
          await txPosts
            .createQueryBuilder()
            .update(PostEntity)
            .set({ dopeCount: () => `GREATEST(\"dope_counts\" + (${delta}), 0)` })
            .where('id = :id', { id: trackId })
            .execute();
          await txUsers
            .createQueryBuilder()
            .update(UserEntity)
            .set({ dopeCount: () => `GREATEST(\"dope_counts\" + (${delta}), 0)` })
            .where('id = :id', { id: post.creatorId })
            .execute();
        } else {
          await txPosts
            .createQueryBuilder()
            .update(PostEntity)
            .set({ nopeCount: () => `GREATEST(\"nope_counts\" + (${delta}), 0)` })
            .where('id = :id', { id: trackId })
            .execute();
          await txUsers
            .createQueryBuilder()
            .update(UserEntity)
            .set({ nopeCount: () => `GREATEST(\"nope_counts\" + (${delta}), 0)` })
            .where('id = :id', { id: post.creatorId })
            .execute();
        }
      };

      if (!prev) {
        await applyDelta(verdict, 1);
      } else if (prev !== verdict) {
        await applyDelta(prev, -1);
        await applyDelta(verdict, 1);
      }

      await txSwipes.upsert(
        {
          userId,
          postId: trackId,
          verdict,
        },
        { conflictPaths: ['userId', 'postId'] },
      );
    });

    const total = await this.swipesRepo.count();
    const dope = await this.swipesRepo.count({ where: { verdict: 'DOPE' } });
    const nope = total - dope;

    this.realtimeGateway.emitTrendingUpdate({ total, dope, nope });

    return { ok: true };
  }
}
