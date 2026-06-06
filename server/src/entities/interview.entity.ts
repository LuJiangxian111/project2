import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CandidatePosition } from './candidate-position.entity';
import { User } from './user.entity';

@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'candidate_position_id' })
  candidatePositionId: number;

  @ManyToOne(
    () => CandidatePosition,
    (cp) => cp.interviews,
  )
  @JoinColumn({ name: 'candidate_position_id' })
  candidatePosition: CandidatePosition;

  @Column()
  round: number;

  @Column({ name: 'interviewer_id' })
  interviewerId: number;

  @ManyToOne(() => User, (user) => user.interviews)
  @JoinColumn({ name: 'interviewer_id' })
  interviewer: User;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ nullable: true })
  score: number;

  @Column({
    type: 'simple-enum',
    enum: ['pending', 'pass', 'fail', 'cancel'],
    default: 'pending',
  })
  result: 'pending' | 'pass' | 'fail' | 'cancel';

  @Column({ name: 'ai_questions', type: 'text', nullable: true })
  aiQuestions: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
