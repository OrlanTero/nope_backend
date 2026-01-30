import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CommentEntity } from './comment.entity';
import { CommentReactionEntity } from './comment-reaction.entity';

function extractMentions(text: string) {
  const out = new Set<string>();
  const re = /(^|\s)@([a-zA-Z0-9_]{2,32})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) out.add(m[2]);
  }
  return [...out].slice(0, 20);
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(CommentReactionEntity)
    private readonly reactionsRepo: Repository<CommentReactionEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepo: Repository<PostEntity>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async incPostComments(postId: string, delta: number) {
    await this.postsRepo
      .createQueryBuilder()
      .update(PostEntity)
      .set({ commentCount: () => `GREATEST("comment_counts" + (${delta}), 0)` })
      .where('id = :id', { id: postId })
      .execute();
  }

  private async incUserComments(userId: string, delta: number) {
    await this.usersRepo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ commentCount: () => `GREATEST("comment_counts" + (${delta}), 0)` })
      .where('id = :id', { id: userId })
      .execute();
  }

  async create(params: {
    userId: string;
    targetType: string;
    targetId: string;
    parentId?: string;
    body?: string;
    gifUrl?: string;
    file?: Express.Multer.File;
    baseUrl: string;
  }) {
    const targetType = params.targetType.trim();
    const targetId = params.targetId.trim();
    if (!targetType || !targetId) throw new BadRequestException('targetType and targetId are required');

    const isPostTarget = targetType === 'post';
    const targetPost = isPostTarget ? await this.postsRepo.findOne({ where: { id: targetId } }) : null;
    if (isPostTarget && !targetPost) throw new BadRequestException('targetId not found');

    if (params.parentId) {
      const parent = await this.commentsRepo.findOne({ where: { id: params.parentId } });
      if (!parent) throw new BadRequestException('parentId not found');
      if (parent.targetType !== targetType || parent.targetId !== targetId) {
        throw new BadRequestException('parentId target mismatch');
      }
    }

    const body = (params.body ?? '').trim();
    const gifUrl = (params.gifUrl ?? '').trim();
    const mentions = extractMentions(body);

    if (!body && !gifUrl && !params.file) {
      throw new BadRequestException('comment must include body, gifUrl, or media');
    }

    const mediaUrl = params.file
      ? await this.storageService.saveUploadedFile({
          file: params.file,
          baseUrl: params.baseUrl,
          prefix: `comments/${targetType}/${targetId}`,
        })
      : null;

    const created = await this.commentsRepo.save(
      this.commentsRepo.create({
        id: randomUUID(),
        userId: params.userId,
        targetType,
        targetId,
        parentId: params.parentId ?? null,
        body,
        mediaUrl,
        gifUrl: gifUrl || null,
        mentions,
        isDeleted: false,
      }),
    );

    if (targetPost) {
      await this.incPostComments(targetPost.id, 1);
      await this.incUserComments(targetPost.creatorId, 1);
    }

    if (mentions.length) {
      const mentionedUsers = await this.usersRepo.find({ where: { username: In(mentions) } });
      await Promise.all(
        mentionedUsers
          .filter((u) => u.id !== params.userId)
          .map((u) =>
            this.notificationsService.create({
              userId: u.id,
              type: 'mention',
              actorId: params.userId,
              entityType: 'comment',
              entityId: created.id,
              data: {
                targetType,
                targetId,
              },
            }),
          ),
      );
    }

    const hydrated = await this.commentsRepo.findOne({ where: { id: created.id }, relations: { user: true } });
    return this.toDto(hydrated ?? created, { dopeCount: 0, iDoped: false, replyCount: 0 });
  }

  async list(params: {
    userId?: string;
    targetType: string;
    targetId: string;
    offset?: number;
    limit?: number;
  }) {
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));

    const comments = await this.commentsRepo.find({
      where: { targetType: params.targetType, targetId: params.targetId },
      order: { createdAt: 'ASC' },
      relations: { user: true },
      skip: offset,
      take: limit,
    });

    const ids = comments.map((c) => c.id);
    if (ids.length === 0) return { items: [], tree: [] };

    const rawCounts = await this.reactionsRepo
      .createQueryBuilder('r')
      .select('r.commentId', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .where('r.commentId IN (:...ids)', { ids })
      .andWhere("r.type = 'DOPE'")
      .groupBy('r.commentId')
      .getRawMany<{ commentId: string; count: string }>();

    const dopeById = new Map(rawCounts.map((r) => [r.commentId, Number(r.count)]));

    const rawReplies = await this.commentsRepo
      .createQueryBuilder('c')
      .select('c.parentId', 'parentId')
      .addSelect('COUNT(*)', 'count')
      .where('c.parentId IN (:...ids)', { ids })
      .andWhere('c.isDeleted = false')
      .groupBy('c.parentId')
      .getRawMany<{ parentId: string; count: string }>();

    const repliesById = new Map(rawReplies.map((r) => [String(r.parentId), Number(r.count)]));

    let iDoped = new Set<string>();
    if (params.userId) {
      const mine = await this.reactionsRepo.find({
        where: { userId: params.userId, type: 'DOPE' },
      });
      iDoped = new Set(mine.map((m) => m.commentId));
    }

    const items = comments.map((c) =>
      this.toDto(c, {
        dopeCount: dopeById.get(c.id) ?? 0,
        iDoped: iDoped.has(c.id),
        replyCount: repliesById.get(c.id) ?? 0,
      }),
    );

    const byId = new Map(items.map((i) => [i.id, { ...i, replies: [] as any[] }]));
    const roots: any[] = [];
    for (const item of byId.values()) {
      if (item.parentId && byId.has(item.parentId)) {
        byId.get(item.parentId)!.replies.push(item);
      } else {
        roots.push(item);
      }
    }

    return { items, tree: roots };
  }

  async toggleDope(params: { userId: string; commentId: string; on?: boolean }) {
    const comment = await this.commentsRepo.findOne({ where: { id: params.commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const existing = await this.reactionsRepo.findOne({
      where: { commentId: params.commentId, userId: params.userId, type: 'DOPE' },
    });

    const desired = params.on;
    if (desired === true) {
      if (!existing) {
        await this.reactionsRepo.save(
          this.reactionsRepo.create({
            id: randomUUID(),
            commentId: params.commentId,
            userId: params.userId,
            type: 'DOPE',
          }),
        );
      }
    } else if (desired === false) {
      if (existing) await this.reactionsRepo.delete({ id: existing.id });
    } else {
      if (existing) await this.reactionsRepo.delete({ id: existing.id });
      else {
        await this.reactionsRepo.save(
          this.reactionsRepo.create({
            id: randomUUID(),
            commentId: params.commentId,
            userId: params.userId,
            type: 'DOPE',
          }),
        );
      }
    }

    const dopeCount = await this.reactionsRepo.count({ where: { commentId: params.commentId, type: 'DOPE' } });
    const iDoped = await this.reactionsRepo.exists({
      where: { commentId: params.commentId, userId: params.userId, type: 'DOPE' },
    });

    return { ok: true, dopeCount, iDoped };
  }

  private toDto(
    c: CommentEntity,
    extra: { dopeCount: number; iDoped: boolean; replyCount: number },
  ) {
    const displayName = c.user?.displayName ?? c.user?.username ?? c.user?.email;
    return {
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      parentId: c.parentId ?? null,
      userId: c.userId,
      userDisplayName: displayName,
      userAvatarUrl: c.user?.avatarUrl ?? null,
      body: c.isDeleted ? '' : c.body,
      mediaUrl: c.isDeleted ? null : c.mediaUrl ?? null,
      gifUrl: c.isDeleted ? null : c.gifUrl ?? null,
      mentions: c.isDeleted ? [] : c.mentions ?? [],
      isDeleted: c.isDeleted,
      dopeCount: extra.dopeCount,
      iDoped: extra.iDoped,
      replyCount: extra.replyCount,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
