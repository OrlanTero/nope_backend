import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'saved_posts' })
@Index('IDX_saved_posts_user_post_unique', ['userId', 'postId'], { unique: true })
@Index('IDX_saved_posts_user', ['userId'])
@Index('IDX_saved_posts_post', ['postId'])
export class SavedPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  postId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
