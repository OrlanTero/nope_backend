import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'profile_visits' })
@Index('IDX_profile_visits_visitor_visited', ['visitorId', 'visitedUserId'])
@Index('IDX_profile_visits_visited', ['visitedUserId'])
export class ProfileVisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  visitorId!: string;

  @Column({ type: 'uuid' })
  visitedUserId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
