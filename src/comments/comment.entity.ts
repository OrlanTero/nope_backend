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

@Entity({ name: 'comments' })
@Index(['targetType', 'targetId'])
@Index(['parentId'])
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  targetType!: string;

  @Column({ type: 'text' })
  targetId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => CommentEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: CommentEntity | null;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'text', nullable: true })
  mediaUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  gifUrl?: string | null;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  mentions!: string[];

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
