import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, type Repository } from 'typeorm';
import { CommentReactionEntity } from '../comments/comment-reaction.entity';
import { CommentEntity } from '../comments/comment.entity';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { PostEntity } from '../posts/post.entity';
import { RecommendationEntity } from '../recommendations/recommendation.entity';
import { SwipeEntity } from '../swipes/swipe.entity';
import { RepostEntity } from '../social/repost.entity';
import { SavedPostEntity } from '../social/saved-post.entity';
import { UserEntity } from '../auth/user.entity';
import { AdminListPostsDto } from './dto/admin-list-posts.dto';
import { AdminListUsersDto } from './dto/admin-list-users.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly leaderboardService: LeaderboardService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(CommentReactionEntity)
    private readonly commentReactionsRepo: Repository<CommentReactionEntity>,
    @InjectRepository(SwipeEntity)
    private readonly swipesRepo: Repository<SwipeEntity>,
    @InjectRepository(RepostEntity)
    private readonly repostsRepo: Repository<RepostEntity>,
    @InjectRepository(SavedPostEntity)
    private readonly savedPostsRepo: Repository<SavedPostEntity>,
    @InjectRepository(RecommendationEntity)
    private readonly recommendationsRepo: Repository<RecommendationEntity>,
  ) {}

  async dashboardSummary() {
    const [users, posts, comments, swipes, recommendations] = await Promise.all([
      this.usersRepo.count(),
      this.postsRepo.count(),
      this.commentsRepo.count(),
      this.swipesRepo.count(),
      this.recommendationsRepo.count(),
    ]);

    return {
      counts: {
        users,
        posts,
        comments,
        swipes,
        recommendations,
      },
    };
  }

  async listUsers(q: AdminListUsersDto) {
    const offset = Math.max(0, q.offset ?? 0);
    const limit = Math.min(200, Math.max(1, q.limit ?? 30));
    const rawQ = q.q?.trim();

    const where =
      rawQ && rawQ.length > 0
        ? [
            { email: ILike(`%${rawQ}%`) },
            { username: ILike(`%${rawQ}%`) },
            { displayName: ILike(`%${rawQ}%`) },
          ]
        : undefined;

    const [items, total] = await this.usersRepo.findAndCount({
      where,
      order: { email: 'ASC' },
      skip: offset,
      take: limit,
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username ?? null,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        emailVerified: u.emailVerified === true,
        profileVerified: u.profileVerified === true,
        profileSet: u.profileSet === true,
        followerCount: u.followerCount ?? 0,
        followingCount: u.followingCount ?? 0,
        dopeCount: u.dopeCount ?? 0,
        nopeCount: u.nopeCount ?? 0,
        repostCount: u.repostCount ?? 0,
        commentCount: u.commentCount ?? 0,
      })),
      offset,
      limit,
      total,
    };
  }

  async updateUser(userId: string, dto: AdminUpdateUserDto) {
    const id = userId.trim();
    if (!id) throw new BadRequestException('Invalid user id');

    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.usersRepo.save({
      ...user,
      emailVerified: dto.emailVerified ?? user.emailVerified,
      profileVerified: dto.profileVerified ?? user.profileVerified,
      profileSet: dto.profileSet ?? user.profileSet,
    });

    return {
      user: {
        id: updated.id,
        email: updated.email,
        username: updated.username ?? null,
        displayName: updated.displayName ?? null,
        avatarUrl: updated.avatarUrl ?? null,
        emailVerified: updated.emailVerified === true,
        profileVerified: updated.profileVerified === true,
        profileSet: updated.profileSet === true,
      },
    };
  }

  vibePosts(q: AdminListDto) {
    return this.leaderboardService.topPosts({ offset: q.offset, limit: q.limit });
  }

  vibeUsers(q: AdminListDto) {
    return this.leaderboardService.topUsers({ offset: q.offset, limit: q.limit });
  }

  vibeHashtags(q: AdminListDto) {
    return this.leaderboardService.topHashtags({ offset: q.offset, limit: q.limit });
  }

  async listPosts(q: AdminListPostsDto) {
    const offset = Math.max(0, q.offset ?? 0);
    const limit = Math.min(200, Math.max(1, q.limit ?? 30));
    const rawQ = q.q?.trim();

    const qb = this.postsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.creator', 'u')
      .orderBy('p.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (rawQ && rawQ.length > 0) {
      qb.andWhere('(p.description ILIKE :q OR u.email ILIKE :q OR u.username ILIKE :q)', {
        q: `%${rawQ}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((p) => ({
        id: p.id,
        kind: p.kind,
        creatorId: p.creatorId,
        creatorEmail: p.creator?.email ?? null,
        creatorUsername: p.creator?.username ?? null,
        creatorDisplayName: p.creator?.displayName ?? null,
        description: p.description,
        hashtags: p.hashtags ?? [],
        privacy: p.privacy,
        dopeCount: p.dopeCount ?? 0,
        nopeCount: p.nopeCount ?? 0,
        commentCount: p.commentCount ?? 0,
        repostCount: p.repostCount ?? 0,
        coverUrl: p.coverUrl ?? null,
        imageUrls: p.imageUrls ?? null,
        videoUrl: p.videoUrl ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      offset,
      limit,
      total,
    };
  }

  async deletePost(postId: string) {
    const id = postId.trim();
    if (!id) throw new BadRequestException('Invalid post id');

    const post = await this.postsRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(SwipeEntity).delete({ postId: id });
      await manager.getRepository(RepostEntity).delete({ postId: id });
      await manager.getRepository(SavedPostEntity).delete({ postId: id });

      await manager.query(
        [
          'DELETE FROM comment_reactions cr',
          'WHERE cr."commentId" IN (',
          '  SELECT c.id FROM comments c WHERE c."targetType" = $1 AND c."targetId" = $2',
          ')',
        ].join(' '),
        ['post', id],
      );

      await manager.getRepository(CommentEntity).delete({ targetType: 'post', targetId: id });

      await manager.getRepository(PostEntity).delete({ id });
    });

    return { ok: true };
  }
}
