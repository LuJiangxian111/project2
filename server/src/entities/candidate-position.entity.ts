import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
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
      'pending_screen',
      'screen_rejected',
      'screen_passed',
      'pending_interview',
      'interview_passed',
      'interview_rejected',
      'abandoned',
      'pending_onboard',
      'onboarded',
    ],
    default: 'pending_screen',
  })
  status:
    | 'pending_screen'
    | 'screen_rejected'
    | 'screen_passed'
    | 'pending_interview'
    | 'interview_passed'
    | 'interview_rejected'
    | 'abandoned'
    | 'pending_onboard'
    | 'onboarded';

  @Column({ name: 'recommend_reason', type: 'text', nullable: true })
  recommendReason: string;

  @Column({ name: 'recommender', length: 100, nullable: true })
  recommender: string;

  @Column({ name: 'push_date', type: 'date', nullable: true })
  pushDate: Date;

  @Column({ name: 'implementation', length: 200, nullable: true })
  implementation: string;

  @Column({ name: 'resume_url', nullable: true })
  resumeUrl: string;

  @Column({ name: 'recommended_at', type: 'datetime' })
  recommendedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Interview, (interview) => interview.candidatePosition)
  interviews: Interview[];
}
