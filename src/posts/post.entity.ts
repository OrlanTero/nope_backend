import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from '../auth/user.entity';

@Entity({ name: 'posts' })
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator?: UserEntity;

  @Column({ type: 'text' })
  kind!: 'photo' | 'video';

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  hashtags!: string[];

  @Column({ type: 'text', default: 'everyone' })
  privacy!: 'everyone' | 'friends' | 'onlyYou';

  @Column({ type: 'text', nullable: true })
  trackTitle?: string | null;

  @Column({ type: 'text', nullable: true })
  trackId?: string | null;

  @Column({ type: 'text', nullable: true })
  trackArtist?: string | null;

  @Column({ type: 'text', nullable: true })
  trackArtworkUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  trackPreviewUrl?: string | null;

  @Column({ type: 'int', nullable: true })
  trackDurationMs?: number | null;

  @Column({ type: 'text', nullable: true })
  videoUrl?: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  imageUrls?: string[] | null;

  @Column({ type: 'text', nullable: true })
  coverUrl?: string | null;

  @Column({ type: 'int', default: 0, name: 'dope_counts' })
  dopeCount!: number;

  @Column({ type: 'int', default: 0, name: 'nope_counts' })
  nopeCount!: number;

  @Column({ type: 'int', default: 0, name: 'repost_counts' })
  repostCount!: number;

  @Column({ type: 'int', default: 0, name: 'comment_counts' })
  commentCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
