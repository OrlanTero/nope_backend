import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type NotificationType = 'mention' | 'repost' | 'follow' | 'message_request';

@Index('IDX_notifications_user_seen', ['userId', 'seenAt'])
@Index('IDX_notifications_user_type_seen', ['userId', 'type', 'seenAt'])
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ type: 'text' })
  type!: NotificationType;

  @Column({ type: 'text', nullable: true })
  entityType?: 'post' | 'comment' | 'conversation' | null;

  @Column({ type: 'text', nullable: true })
  entityId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @Column({ type: 'timestamptz', nullable: true })
  seenAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
