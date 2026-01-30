import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import { UserEntity } from '../auth/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationEntity, type NotificationType } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(params: {
    userId: string;
    type: NotificationType;
    actorId?: string;
    entityType?: 'post' | 'comment' | 'conversation';
    entityId?: string;
    data?: any;
  }) {
    if (!params.userId) return { ok: true };

    const saved = await this.notifRepo.save(
      this.notifRepo.create({
        id: randomUUID(),
        userId: params.userId,
        actorId: params.actorId ?? null,
        type: params.type,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        data: params.data ?? null,
        seenAt: null,
      }),
    );

    this.realtimeGateway.emitToUser(params.userId, 'notifications:dirty', {
      type: params.type,
      createdAt: saved.createdAt.toISOString(),
    });

    return { ok: true };
  }

  async summary(params: { userId: string }) {
    const limit = 80;
    const rows = await this.notifRepo.find({
      where: { userId: params.userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const unseen = rows.filter((r) => !r.seenAt);

    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
    const actors = actorIds.length ? await this.usersRepo.find({ where: { id: In(actorIds) } }) : [];
    const actorById = new Map(
      actors.map((u) => [u.id, { id: u.id, displayName: u.displayName ?? u.username ?? u.email, avatarUrl: u.avatarUrl ?? null }]),
    );

    const types: NotificationType[] = ['mention', 'repost', 'follow', 'message_request'];

    const groups = types
      .map((t) => {
        const allOfType = rows.filter((r) => r.type === t);
        const unseenOfType = unseen.filter((r) => r.type === t);
        if (allOfType.length === 0) return null;

        const latest = allOfType[0];
        const latestActors: any[] = [];
        const seenActor = new Set<string>();
        for (const r of unseenOfType.slice(0, 30)) {
          if (!r.actorId) continue;
          if (seenActor.has(r.actorId)) continue;
          const a = actorById.get(r.actorId);
          if (a) latestActors.push(a);
          seenActor.add(r.actorId);
          if (latestActors.length >= 3) break;
        }

        return {
          type: t,
          unreadCount: unseenOfType.length,
          latestAt: latest.createdAt.toISOString(),
          latestActors,
          latestEntityType: latest.entityType ?? undefined,
          latestEntityId: latest.entityId ?? undefined,
          latestData: latest.data ?? undefined,
        };
      })
      .filter(Boolean);

    const unreadTotal = unseen.length;

    return {
      unreadTotal,
      groups,
    };
  }

  async markSeen(params: { userId: string; type?: NotificationType }) {
    const now = new Date();
    if (params.type) {
      await this.notifRepo
        .createQueryBuilder()
        .update(NotificationEntity)
        .set({ seenAt: now })
        .where('"userId" = :uid', { uid: params.userId })
        .andWhere('"type" = :t', { t: params.type })
        .andWhere('"seenAt" IS NULL')
        .execute();
      return { ok: true };
    }

    await this.notifRepo
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ seenAt: now })
      .where('"userId" = :uid', { uid: params.userId })
      .andWhere('"seenAt" IS NULL')
      .execute();

    return { ok: true };
  }
}
