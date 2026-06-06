import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Candidate } from './candidate.entity';
import { Position } from './position.entity';
import { Interview } from './interview.entity';

@Entity('candidate_positions')
export class CandidatePosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_id' })
  candidateId: number;

  @ManyToOne(() => Candidate, (candidate) => candidate.candidatePositions)
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @Column({ name: 'position_id' })
  positionId: number;

  @ManyToOne(() => Position, (position) => position.candidatePositions)
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'match_score', default: 0 })
  matchScore: number;

  @Column({ name: 'match_detail', type: 'text', nullable: true })
  matchDetail: string;

  @Column({
    type: 'simple-enum',
    enum: [
      'recommended',
      'screening',
      'interviewing',
      'offered',
      'hired',
      'rejected',
      'withdrawn',
    ],
    default: 'recommended',
  })
  status:
    | 'recommended'
    | 'screening'
    | 'interviewing'
    | 'offered'
    | 'hired'
    | 'rejected'
    | 'withdrawn';

  @Column({ name: 'recommended_at', type: 'datetime' })
  recommendedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Interview, (interview) => interview.candidatePosition)
  interviews: Interview[];
}
