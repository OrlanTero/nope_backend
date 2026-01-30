import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../auth/user.entity';
import { ConversationEntity } from './conversation.entity';

@Entity({ name: 'messages' })
@Index(['conversationId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation?: ConversationEntity;

  @Index()
  @Column({ type: 'uuid' })
  senderId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender?: UserEntity;

  @Column({ type: 'text' })
  type!: 'text' | 'gif' | 'media' | 'sticker';

  @Column({ type: 'text', nullable: true })
  text?: string | null;

  @Column({ type: 'text', nullable: true })
  gifUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  mediaUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  stickerUrl?: string | null;

  @Column({ type: 'uuid', nullable: true })
  replyToMessageId?: string | null;

  @ManyToOne(() => MessageEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replyToMessageId' })
  replyTo?: MessageEntity | null;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
