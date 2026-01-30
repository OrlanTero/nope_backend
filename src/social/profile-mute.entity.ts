import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'profile_mutes' })
@Index('IDX_profile_mutes_muter_muted_unique', ['muterId', 'mutedUserId'], { unique: true })
@Index('IDX_profile_mutes_muter', ['muterId'])
@Index('IDX_profile_mutes_muted', ['mutedUserId'])
export class ProfileMuteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  muterId!: string;

  @Column({ type: 'uuid' })
  mutedUserId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
