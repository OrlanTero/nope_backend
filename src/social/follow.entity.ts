import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'follows' })
@Index('IDX_follows_follower_following_unique', ['followerId', 'followingId'], { unique: true })
@Index('IDX_follows_follower', ['followerId'])
@Index('IDX_follows_following', ['followingId'])
export class FollowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  followerId!: string;

  @Column({ type: 'uuid' })
  followingId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
