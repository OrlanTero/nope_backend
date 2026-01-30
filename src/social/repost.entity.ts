import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reposts' })
@Index('IDX_reposts_user_post_unique', ['userId', 'postId'], { unique: true })
@Index('IDX_reposts_user', ['userId'])
@Index('IDX_reposts_post', ['postId'])
export class RepostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  postId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
