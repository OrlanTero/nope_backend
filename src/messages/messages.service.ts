import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import type { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { UserEntity } from '../auth/user.entity';
import { FollowEntity } from '../social/follow.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationEntity } from './conversation.entity';
import { ConversationParticipantEntity } from './conversation-participant.entity';
import { MessageEntity } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepo: Repository<ConversationEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participantsRepo: Repository<ConversationParticipantEntity>,
    @InjectRepository(MessageEntity)
    private readonly messagesRepo: Repository<MessageEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(FollowEntity)
    private readonly followsRepo: Repository<FollowEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createDirectConversation(params: { userId: string; otherUserId: string }) {
    if (params.userId === params.otherUserId) {
      throw new BadRequestException('Cannot create direct conversation with yourself');
    }

    const other = await this.usersRepo.findOne({ where: { id: params.otherUserId } });
    if (!other) throw new NotFoundException('User not found');

    const existing = await this.findExistingDirect(params.userId, params.otherUserId);
    if (existing) return existing;

    const convo = await this.conversationsRepo.save(
      this.conversationsRepo.create({
        id: randomUUID(),
        type: 'direct',
        title: null,
        avatarUrl: null,
        lastMessageAt: null,
      }),
    );

    await this.participantsRepo.save([
      this.participantsRepo.create({
        id: randomUUID(),
        conversationId: convo.id,
        userId: params.userId,
        role: 'member',
      }),
      this.participantsRepo.create({
        id: randomUUID(),
        conversationId: convo.id,
        userId: params.otherUserId,
        role: 'member',
      }),
    ]);

    return convo;
  }

  async createGroupConversation(params: { userId: string; title?: string; participantUserIds: string[] }) {
    const unique = new Set([params.userId, ...(params.participantUserIds ?? [])]);
    const ids = [...unique];
    if (ids.length < 3) throw new BadRequestException('Group requires at least 3 unique participants');

    const found = await this.usersRepo.find({ where: ids.map((id) => ({ id })) });
    if (found.length !== ids.length) throw new BadRequestException('One or more participants not found');

    const convo = await this.conversationsRepo.save(
      this.conversationsRepo.create({
        id: randomUUID(),
        type: 'group',
        title: (params.title ?? '').trim() || null,
        avatarUrl: null,
        lastMessageAt: null,
      }),
    );

    await this.participantsRepo.save(
      ids.map((uid) =>
        this.participantsRepo.create({
          id: randomUUID(),
          conversationId: convo.id,
          userId: uid,
          role: uid === params.userId ? 'admin' : 'member',
        }),
      ),
    );

    return convo;
  }

  async listConversations(params: { userId: string }) {
    const parts = await this.participantsRepo.find({
      where: { userId: params.userId },
      relations: { conversation: true },
    });

    const convoIds = parts.map((p) => p.conversationId);
    if (convoIds.length === 0) return { items: [] };

    const conversations = await this.conversationsRepo.find({ where: { id: In(convoIds) } });
    const convoById = new Map(conversations.map((c) => [c.id, c]));
    const partByConvoId = new Map(parts.map((p) => [p.conversationId, p]));

    const lastByConvo = await Promise.all(
      convoIds.map(async (cid) => {
        const m = await this.messagesRepo.findOne({
          where: { conversationId: cid },
          order: { createdAt: 'DESC' },
          relations: { sender: true },
        });
        return [cid, m] as const;
      }),
    );
    const lastMsgById = new Map(lastByConvo);

    const unreadByConvo = await Promise.all(
      convoIds.map(async (cid) => {
        const p = partByConvoId.get(cid);
        const lastReadAt = p?.lastReadAt ?? new Date(0);
        const count = await this.messagesRepo
          .createQueryBuilder('m')
          .where('m.conversationId = :cid', { cid })
          .andWhere('m.createdAt > :lastReadAt', { lastReadAt })
          .andWhere('m.senderId != :me', { me: params.userId })
          .getCount();
        return [cid, count] as const;
      }),
    );
    const unreadMap = new Map(unreadByConvo);

    const items = await Promise.all(
      convoIds.map(async (cid) => {
        const convo = convoById.get(cid);
        const p = partByConvoId.get(cid);
        if (!convo || !p) return null;

        let displayName: string | null = convo.title ?? null;
        let username: string | null = null;
        let avatarUrl: string | null = convo.avatarUrl ?? null;
        let otherUserId: string | null = null;

        if (convo.type === 'direct') {
          const others = await this.participantsRepo.find({
            where: { conversationId: cid },
            relations: { user: true },
          });
          const otherPart = others.find((x) => x.userId !== params.userId);
          otherUserId = otherPart?.userId ?? null;
          const other = otherPart?.user;
          displayName = (other?.displayName ?? other?.username ?? other?.email ?? 'User') as string;
          username = (other?.username ?? null) as string | null;
          avatarUrl = (other?.avatarUrl ?? avatarUrl ?? null) as string | null;
        }

        const last = lastMsgById.get(cid);

        return {
          id: cid,
          type: convo.type,
          avatarUrl,
          displayName,
          username,
          otherUserId,
          isPinned: p.isPinned,
          pinnedAt: p.pinnedAt?.toISOString() ?? null,
          mutedUntil: p.mutedUntil?.toISOString() ?? null,
          lastMessageAt: convo.lastMessageAt?.toISOString() ?? null,
          unreadCount: unreadMap.get(cid) ?? 0,
          lastMessage: last ? this.toMessageDto(last) : null,
        };
      }),
    );

    const cleaned = items.filter(Boolean) as any[];
    cleaned.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ap = a.isPinned ? Date.parse(a.pinnedAt ?? '') || 0 : 0;
      const bp = b.isPinned ? Date.parse(b.pinnedAt ?? '') || 0 : 0;
      if (a.isPinned && b.isPinned && ap !== bp) return bp - ap;
      const at = Date.parse(a.lastMessageAt ?? '') || 0;
      const bt = Date.parse(b.lastMessageAt ?? '') || 0;
      return bt - at;
    });

    return { items: cleaned };
  }

  async listMessages(params: { userId: string; conversationId: string; beforeId?: string; limit?: number }) {
    await this.assertParticipant(params.userId, params.conversationId);

    const limit = Math.min(200, Math.max(1, params.limit ?? 50));

    let beforeCreatedAt: Date | null = null;
    if (params.beforeId) {
      const before = await this.messagesRepo.findOne({ where: { id: params.beforeId, conversationId: params.conversationId } });
      if (before) beforeCreatedAt = before.createdAt;
    }

    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.conversationId = :conversationId', { conversationId: params.conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit);

    if (beforeCreatedAt) {
      qb.andWhere('m.createdAt < :beforeCreatedAt', { beforeCreatedAt });
    }

    const rows = await qb.getMany();
    const items = rows.map((m) => this.toMessageDto(m));
    return { items };
  }

  async sendMessage(params: {
    userId: string;
    conversationId: string;
    type: 'text' | 'gif' | 'media' | 'sticker';
    text?: string;
    gifUrl?: string;
    replyToMessageId?: string;
    file?: Express.Multer.File;
    baseUrl: string;
  }) {
    await this.assertParticipant(params.userId, params.conversationId);

    const convo = await this.conversationsRepo.findOne({ where: { id: params.conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    const hadMessages = await this.messagesRepo.exist({ where: { conversationId: params.conversationId } });

    const type = params.type;
    const text = (params.text ?? '').trim();
    const gifUrl = (params.gifUrl ?? '').trim();

    if (type === 'text' && !text) throw new BadRequestException('text is required');
    if (type === 'gif' && !gifUrl) throw new BadRequestException('gifUrl is required');
    if (type === 'media' && !params.file) throw new BadRequestException('media file is required');

    if (params.replyToMessageId) {
      const exists = await this.messagesRepo.exists({ where: { id: params.replyToMessageId, conversationId: params.conversationId } });
      if (!exists) throw new BadRequestException('replyToMessageId not found');
    }

    const mediaUrl = params.file
      ? await this.storageService.saveUploadedFile({
          file: params.file,
          baseUrl: params.baseUrl,
          prefix: `messages/${params.conversationId}`,
        })
      : null;

    const created = await this.messagesRepo.save(
      this.messagesRepo.create({
        id: randomUUID(),
        conversationId: params.conversationId,
        senderId: params.userId,
        type,
        text: type === 'text' ? text : null,
        gifUrl: type === 'gif' ? gifUrl : null,
        mediaUrl: type === 'media' ? mediaUrl : null,
        stickerUrl: type === 'sticker' ? mediaUrl : null,
        replyToMessageId: params.replyToMessageId ?? null,
        isDeleted: false,
      }),
    );

    if (!hadMessages && convo.type === 'direct') {
      const parts = await this.participantsRepo.find({ where: { conversationId: params.conversationId } });
      const other = parts.find((p) => p.userId !== params.userId);
      if (other) {
        const receiverFollowsSender = await this.followsRepo.exist({
          where: { followerId: other.userId, followingId: params.userId },
        });
        if (!receiverFollowsSender) {
          await this.notificationsService.create({
            userId: other.userId,
            type: 'message_request',
            actorId: params.userId,
            entityType: 'conversation',
            entityId: params.conversationId,
          });
        }
      }
    }

    await this.conversationsRepo.update(
      { id: params.conversationId },
      { lastMessageAt: created.createdAt },
    );

    const hydrated = await this.messagesRepo.findOne({
      where: { id: created.id },
      relations: { sender: true },
    });

    if (!hydrated) throw new NotFoundException('Message not found');
    const dto = this.toMessageDto(hydrated);

    const parts = await this.participantsRepo.find({ where: { conversationId: params.conversationId } });
    const recipientIds = parts.map((p) => p.userId).filter((uid) => uid !== params.userId);
    for (const uid of recipientIds) {
      this.realtimeGateway.emitToUser(uid, 'messages:new', { message: dto });
    }

    return dto;
  }

  async markRead(params: { userId: string; conversationId: string; lastReadMessageId?: string }) {
    const participant = await this.assertParticipant(params.userId, params.conversationId);

    let lastReadAt = new Date();
    if (params.lastReadMessageId) {
      const msg = await this.messagesRepo.findOne({ where: { id: params.lastReadMessageId, conversationId: params.conversationId } });
      if (!msg) throw new BadRequestException('lastReadMessageId not found');
      lastReadAt = msg.createdAt;
    }

    await this.participantsRepo.update(
      { id: participant.id },
      {
        lastReadMessageId: params.lastReadMessageId ?? participant.lastReadMessageId ?? null,
        lastReadAt,
      },
    );

    const parts = await this.participantsRepo.find({ where: { conversationId: params.conversationId } });
    const recipientIds = parts.map((p) => p.userId).filter((uid) => uid !== params.userId);
    for (const uid of recipientIds) {
      this.realtimeGateway.emitToUser(uid, 'messages:read', {
        conversationId: params.conversationId,
        readerId: params.userId,
        lastReadMessageId: params.lastReadMessageId ?? null,
      });
    }

    return { ok: true };
  }

  async setPinned(params: { userId: string; conversationId: string; pinned: boolean }) {
    const participant = await this.assertParticipant(params.userId, params.conversationId);

    await this.participantsRepo.update(
      { id: participant.id },
      {
        isPinned: params.pinned,
        pinnedAt: params.pinned ? new Date() : null,
      },
    );

    return { ok: true };
  }

  async mute(params: { userId: string; conversationId: string; muteForSeconds?: number }) {
    const participant = await this.assertParticipant(params.userId, params.conversationId);

    const seconds = Math.max(0, params.muteForSeconds ?? 0);
    const mutedUntil = seconds === 0 ? null : new Date(Date.now() + seconds * 1000);

    await this.participantsRepo.update(
      { id: participant.id },
      {
        mutedUntil,
      },
    );

    return { ok: true, mutedUntil: mutedUntil?.toISOString() ?? null };
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const p = await this.participantsRepo.findOne({ where: { userId, conversationId } });
    if (!p) throw new ForbiddenException('Not a participant');
    return p;
  }

  private async findExistingDirect(a: string, b: string) {
    const parts = await this.participantsRepo
      .createQueryBuilder('p')
      .select('p.conversationId', 'conversationId')
      .addSelect('COUNT(*)', 'count')
      .where('p.userId IN (:...ids)', { ids: [a, b] })
      .groupBy('p.conversationId')
      .having('COUNT(*) = 2')
      .getRawMany<{ conversationId: string; count: string }>();

    const convoIds = parts.map((r) => r.conversationId);
    if (convoIds.length === 0) return null;

    const convo = await this.conversationsRepo.findOne({ where: { id: convoIds[0], type: 'direct' } });
    return convo ?? null;
  }

  private toMessageDto(m: MessageEntity) {
    const senderName = m.sender?.displayName ?? m.sender?.username ?? m.sender?.email ?? null;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderDisplayName: senderName,
      type: m.type,
      text: m.isDeleted ? null : m.text ?? null,
      gifUrl: m.isDeleted ? null : m.gifUrl ?? null,
      mediaUrl: m.isDeleted ? null : m.mediaUrl ?? null,
      stickerUrl: m.isDeleted ? null : m.stickerUrl ?? null,
      replyToMessageId: m.replyToMessageId ?? null,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
