import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'comment_reactions' })
@Unique(['commentId', 'userId', 'type'])
export class CommentReactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  commentId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  type!: 'DOPE';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
