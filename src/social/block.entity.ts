import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'blocks' })
@Index('IDX_blocks_blocker_blocked_unique', ['blockerId', 'blockedId'], { unique: true })
@Index('IDX_blocks_blocker', ['blockerId'])
@Index('IDX_blocks_blocked', ['blockedId'])
export class BlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  blockerId!: string;

  @Column({ type: 'uuid' })
  blockedId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
