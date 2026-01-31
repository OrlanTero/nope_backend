import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import type { Repository } from 'typeorm';
import { BlockEntity } from './block.entity';
import { FollowEntity } from './follow.entity';
import { ProfileMuteEntity } from './profile-mute.entity';
import { ProfileVisitEntity } from './profile-visit.entity';
import { RepostEntity } from './repost.entity';
import { SavedPostEntity } from './saved-post.entity';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
    @InjectRepository(FollowEntity)
    private readonly followsRepo: Repository<FollowEntity>,
    @InjectRepository(BlockEntity)
    private readonly blocksRepo: Repository<BlockEntity>,
    @InjectRepository(ProfileMuteEntity)
    private readonly mutesRepo: Repository<ProfileMuteEntity>,
    @InjectRepository(ProfileVisitEntity)
    private readonly visitsRepo: Repository<ProfileVisitEntity>,
    @InjectRepository(RepostEntity)
    private readonly repostsRepo: Repository<RepostEntity>,
    @InjectRepository(SavedPostEntity)
    private readonly savesRepo: Repository<SavedPostEntity>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async incFollowers(userId: string, delta: number) {
    await this.usersRepo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ followerCount: () => `GREATEST("follower_counts" + (${delta}), 0)` })
      .where('id = :id', { id: userId })
      .execute();
  }

  private async incFollowing(userId: string, delta: number) {
    await this.usersRepo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ followingCount: () => `GREATEST("following_counts" + (${delta}), 0)` })
      .where('id = :id', { id: userId })
      .execute();
  }

  private async incUserReposts(userId: string, delta: number) {
    await this.usersRepo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ repostCount: () => `GREATEST("repost_counts" + (${delta}), 0)` })
      .where('id = :id', { id: userId })
      .execute();
  }

  private async incPostReposts(postId: string, delta: number) {
    await this.postsRepo
      .createQueryBuilder()
      .update(PostEntity)
      .set({ repostCount: () => `GREATEST("repost_counts" + (${delta}), 0)` })
      .where('id = :id', { id: postId })
      .execute();
  }

  async toggleRepost(params: { userId: string; postId: string }) {
    const post = await this.postsRepo.findOne({ where: { id: params.postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.repostsRepo.findOne({ where: { userId: params.userId, postId: params.postId } });
    if (existing) {
      await this.repostsRepo.delete({ id: existing.id });
      await this.incPostReposts(post.id, -1);
      if (post.creatorId !== params.userId) {
        await this.incUserReposts(post.creatorId, -1);
      }
      return { ok: true, reposted: false };
    }

    await this.repostsRepo.save(
      this.repostsRepo.create({
        id: randomUUID(),
        userId: params.userId,
        postId: params.postId,
      }),
    );

    await this.incPostReposts(post.id, 1);
    if (post.creatorId !== params.userId) {
      await this.incUserReposts(post.creatorId, 1);
    }

    if (post.creatorId !== params.userId) {
      await this.notificationsService.create({
        userId: post.creatorId,
        type: 'repost',
        actorId: params.userId,
        entityType: 'post',
        entityId: post.id,
      });
    }

    return { ok: true, reposted: true };
  }

  async getProfile(params: { viewerId?: string; userId: string }) {
    const u = await this.usersRepo.findOne({ where: { id: params.userId } });
    if (!u) throw new NotFoundException('User not found');

    if (params.viewerId) {
      const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.viewerId } });
      if (blocked) throw new ForbiddenException('User not available');
    }

    const meBlocked = params.viewerId
      ? await this.blocksRepo.findOne({ where: { blockerId: params.viewerId, blockedId: params.userId } })
      : null;

    const followersCount = u.followerCount ?? 0;
    const followingCount = u.followingCount ?? 0;
    const dopesCount = u.dopeCount ?? 0;

    const isFollowing = params.viewerId
      ? await this.followsRepo.exist({ where: { followerId: params.viewerId, followingId: params.userId } })
      : false;

    const isMuted = params.viewerId
      ? await this.mutesRepo.exist({ where: { muterId: params.viewerId, mutedUserId: params.userId } })
      : false;

    return {
      user: {
        id: u.id,
        username: u.username ?? null,
        displayName: u.displayName ?? null,
        avatarUrl: u.avatarUrl ?? null,
        bio: u.bio ?? null,
        profileVerified: u.profileVerified === true,
      },
      stats: {
        followers: followersCount,
        following: followingCount,
        dopes: dopesCount,
      },
      viewer: {
        isMe: params.viewerId ? params.viewerId === params.userId : false,
        isFollowing,
        isBlocked: Boolean(meBlocked),
        isMuted,
      },
    };
  }

  async setMute(params: { userId: string; targetUserId: string; on: boolean }) {
    if (params.userId === params.targetUserId) throw new BadRequestException('Cannot mute yourself');
    const target = await this.usersRepo.findOne({ where: { id: params.targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.mutesRepo.findOne({ where: { muterId: params.userId, mutedUserId: params.targetUserId } });
    if (params.on) {
      if (!existing) {
        await this.mutesRepo.save(
          this.mutesRepo.create({
            id: randomUUID(),
            muterId: params.userId,
            mutedUserId: params.targetUserId,
          }),
        );
      }
    } else {
      if (existing) await this.mutesRepo.delete({ id: existing.id });
    }

    return { ok: true, isMuted: params.on };
  }

  async listRecentVisitors(params: { userId: string; limit?: number }) {
    const limit = Math.min(200, Math.max(1, params.limit ?? 30));

    const visits = await this.visitsRepo.find({
      where: { visitedUserId: params.userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const ids = [...new Set(visits.map((v) => v.visitorId))];
    const users = ids.length ? await this.usersRepo.find({ where: { id: In(ids) } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return {
      items: visits
        .map((v) => {
          const u = byId.get(v.visitorId);
          if (!u) return null;
          return {
            userId: u.id,
            displayName: u.displayName ?? u.username ?? u.email,
            avatarUrl: u.avatarUrl ?? null,
            visitedAt: v.createdAt.toISOString(),
          };
        })
        .filter(Boolean),
    };
  }

  async listFollowers(params: { viewerId: string; userId: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 30));

    const u = await this.usersRepo.findOne({ where: { id: params.userId } });
    if (!u) throw new NotFoundException('User not found');

    const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.viewerId } });
    if (blocked) throw new ForbiddenException('User not available');

    const rows = await this.followsRepo.find({
      where: { followingId: params.userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const ids = rows.map((r) => r.followerId);
    if (ids.length === 0) return { items: [], offset, limit };

    const users = await this.usersRepo.find({ where: { id: In(ids) } });
    const byId = new Map(users.map((x) => [x.id, x]));

    const followedByViewer = await this.followsRepo.find({
      where: {
        followerId: params.viewerId,
        followingId: In(ids),
      },
    });
    const viewerFollowing = new Set(followedByViewer.map((r) => r.followingId));

    const items = rows
      .map((r) => {
        const x = byId.get(r.followerId);
        if (!x) return null;
        return {
          id: x.id,
          username: x.username ?? null,
          displayName: x.displayName ?? null,
          avatarUrl: x.avatarUrl ?? null,
          isFollowing: viewerFollowing.has(x.id),
          isMe: x.id === params.viewerId,
        };
      })
      .filter(Boolean);

    return { items, offset, limit };
  }

  async listFollowing(params: { viewerId: string; userId: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 30));

    const u = await this.usersRepo.findOne({ where: { id: params.userId } });
    if (!u) throw new NotFoundException('User not found');

    const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.viewerId } });
    if (blocked) throw new ForbiddenException('User not available');

    const rows = await this.followsRepo.find({
      where: { followerId: params.userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const ids = rows.map((r) => r.followingId);
    if (ids.length === 0) return { items: [], offset, limit };

    const users = await this.usersRepo.find({ where: { id: In(ids) } });
    const byId = new Map(users.map((x) => [x.id, x]));

    const followedByViewer = await this.followsRepo.find({
      where: {
        followerId: params.viewerId,
        followingId: In(ids),
      },
    });
    const viewerFollowing = new Set(followedByViewer.map((r) => r.followingId));

    const items = rows
      .map((r) => {
        const x = byId.get(r.followingId);
        if (!x) return null;
        return {
          id: x.id,
          username: x.username ?? null,
          displayName: x.displayName ?? null,
          avatarUrl: x.avatarUrl ?? null,
          isFollowing: viewerFollowing.has(x.id),
          isMe: x.id === params.viewerId,
        };
      })
      .filter(Boolean);

    return { items, offset, limit };
  }

  async recordVisit(params: { visitorId: string; visitedUserId: string }) {
    if (params.visitorId === params.visitedUserId) return { ok: true };

    const visited = await this.usersRepo.findOne({ where: { id: params.visitedUserId } });
    if (!visited) throw new NotFoundException('User not found');

    const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.visitedUserId, blockedId: params.visitorId } });
    if (blocked) throw new ForbiddenException('User not available');

    await this.visitsRepo.save(
      this.visitsRepo.create({
        id: randomUUID(),
        visitorId: params.visitorId,
        visitedUserId: params.visitedUserId,
      }),
    );

    return { ok: true };
  }

  async setFollow(params: { userId: string; targetUserId: string; on: boolean }) {
    if (params.userId === params.targetUserId) throw new BadRequestException('Cannot follow yourself');

    const target = await this.usersRepo.findOne({ where: { id: params.targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.targetUserId, blockedId: params.userId } });
    if (blocked) throw new ForbiddenException('User not available');

    const existing = await this.followsRepo.findOne({ where: { followerId: params.userId, followingId: params.targetUserId } });

    if (params.on) {
      if (!existing) {
        await this.followsRepo.save(
          this.followsRepo.create({
            id: randomUUID(),
            followerId: params.userId,
            followingId: params.targetUserId,
          }),
        );

        await this.incFollowing(params.userId, 1);
        await this.incFollowers(params.targetUserId, 1);

        await this.notificationsService.create({
          userId: params.targetUserId,
          type: 'follow',
          actorId: params.userId,
        });
      }
    } else {
      if (existing) {
        await this.followsRepo.delete({ id: existing.id });

        await this.incFollowing(params.userId, -1);
        await this.incFollowers(params.targetUserId, -1);
      }
    }

    return {
      ok: true,
      followers: target?.followerCount ?? 0,
      following: target?.followingCount ?? 0,
      isFollowing: params.on,
    };
  }

  async setBlock(params: { userId: string; targetUserId: string; on: boolean }) {
    if (params.userId === params.targetUserId) throw new BadRequestException('Cannot block yourself');

    const target = await this.usersRepo.findOne({ where: { id: params.targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.targetUserId } });

    if (params.on) {
      if (!existing) {
        await this.blocksRepo.save(
          this.blocksRepo.create({
            id: randomUUID(),
            blockerId: params.userId,
            blockedId: params.targetUserId,
          }),
        );
      }
      const iFollowed = await this.followsRepo.exist({ where: { followerId: params.userId, followingId: params.targetUserId } });
      const theyFollowed = await this.followsRepo.exist({ where: { followerId: params.targetUserId, followingId: params.userId } });

      await this.followsRepo.delete({ followerId: params.userId, followingId: params.targetUserId });
      await this.followsRepo.delete({ followerId: params.targetUserId, followingId: params.userId });

      if (iFollowed) {
        await this.incFollowing(params.userId, -1);
        await this.incFollowers(params.targetUserId, -1);
      }
      if (theyFollowed) {
        await this.incFollowing(params.targetUserId, -1);
        await this.incFollowers(params.userId, -1);
      }
    } else {
      if (existing) {
        await this.blocksRepo.delete({ id: existing.id });
      }
    }

    return { ok: true, isBlocked: params.on };
  }

  async listProfilePosts(params: { viewerId?: string; userId: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 60));

    const u = await this.usersRepo.findOne({ where: { id: params.userId } });
    if (!u) throw new NotFoundException('User not found');

    if (params.viewerId) {
      const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.viewerId } });
      if (blocked) throw new ForbiddenException('User not available');
    }

    const posts = await this.postsRepo.find({
      where: { creatorId: params.userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const items = posts.map((p) => ({
      id: p.id,
      kind: p.kind,
      thumbnailUrl: p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '',
      createdAt: p.createdAt.toISOString(),
    }));

    return { items, offset, limit };
  }

  async listReposts(params: { viewerId?: string; userId: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 60));

    const u = await this.usersRepo.findOne({ where: { id: params.userId } });
    if (!u) throw new NotFoundException('User not found');

    if (params.viewerId) {
      const blocked = await this.blocksRepo.findOne({ where: { blockerId: params.userId, blockedId: params.viewerId } });
      if (blocked) throw new ForbiddenException('User not available');
    }

    const rows = await this.repostsRepo.find({
      where: { userId: params.userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const postIds = rows.map((r) => r.postId);
    if (postIds.length === 0) return { items: [], offset, limit };

    const posts = await this.postsRepo.find({ where: { id: In(postIds) } });
    const byId = new Map(posts.map((p) => [p.id, p]));

    const items = rows
      .map((r) => {
        const p = byId.get(r.postId);
        if (!p) return null;
        return {
          id: p.id,
          kind: p.kind,
          thumbnailUrl: p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '',
          repostedAt: r.createdAt.toISOString(),
        };
      })
      .filter(Boolean);

    return { items, offset, limit };
  }

  async listSaved(params: { userId: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 60));

    const rows = await this.savesRepo.find({
      where: { userId: params.userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const postIds = rows.map((r) => r.postId);
    if (postIds.length === 0) return { items: [], offset, limit };

    const posts = await this.postsRepo.find({ where: { id: In(postIds) } });
    const byId = new Map(posts.map((p) => [p.id, p]));

    const items = rows
      .map((r) => {
        const p = byId.get(r.postId);
        if (!p) return null;
        return {
          id: p.id,
          kind: p.kind,
          thumbnailUrl: p.coverUrl ?? p.imageUrls?.[0] ?? p.videoUrl ?? '',
          savedAt: r.createdAt.toISOString(),
        };
      })
      .filter(Boolean);

    return { items, offset, limit };
  }

  async toggleSave(params: { userId: string; postId: string }) {
    const post = await this.postsRepo.findOne({ where: { id: params.postId } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.savesRepo.findOne({ where: { userId: params.userId, postId: params.postId } });
    if (existing) {
      await this.savesRepo.delete({ id: existing.id });
      return { ok: true, saved: false };
    }

    await this.savesRepo.save(
      this.savesRepo.create({
        id: randomUUID(),
        userId: params.userId,
        postId: params.postId,
      }),
    );

    return { ok: true, saved: true };
  }
}
