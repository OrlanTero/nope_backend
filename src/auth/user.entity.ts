import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Index({ unique: true, where: 'username IS NOT NULL' })
  @Column({ type: 'text', nullable: true })
  username?: string | null;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text', nullable: true })
  provider?: 'password' | 'google' | null;

  @Column({ type: 'text', nullable: true })
  googleSub?: string | null;

  @Column({ type: 'text', nullable: true })
  displayName?: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  bio?: string | null;

  @Column({ type: 'boolean', default: false })
  twoFaEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  profileVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  profileSet!: boolean;

  @Column({ type: 'text', nullable: true })
  firstName?: string | null;

  @Column({ type: 'text', nullable: true })
  lastName?: string | null;

  @Column({ type: 'text', nullable: true })
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null;

  @Column({ type: 'text', nullable: true })
  birthdate?: string | null;

  @Column({ type: 'int', default: 0, name: 'follower_counts' })
  followerCount!: number;

  @Column({ type: 'int', default: 0, name: 'following_counts' })
  followingCount!: number;

  @Column({ type: 'int', default: 0, name: 'dope_counts' })
  dopeCount!: number;

  @Column({ type: 'int', default: 0, name: 'nope_counts' })
  nopeCount!: number;

  @Column({ type: 'int', default: 0, name: 'repost_counts' })
  repostCount!: number;

  @Column({ type: 'int', default: 0, name: 'comment_counts' })
  commentCount!: number;
}
