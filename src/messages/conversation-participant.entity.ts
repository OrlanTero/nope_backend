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

@Entity({ name: 'conversation_participants' })
@Index(['conversationId', 'userId'], { unique: true })
@Index('IDX_18c4ba3b127461649e5f5039db', ['userId'])
export class ConversationParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation?: ConversationEntity;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'text', default: 'member' })
  role!: 'member' | 'admin';

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  pinnedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  mutedUntil?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
