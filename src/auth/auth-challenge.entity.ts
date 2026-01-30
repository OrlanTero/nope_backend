import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuthChallengePurpose = 'email_verify' | 'login_2fa';

@Index(['userId', 'purpose'])
@Entity({ name: 'auth_challenges' })
export class AuthChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  purpose!: AuthChallengePurpose;

  @Column({ type: 'text' })
  codeHash!: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
