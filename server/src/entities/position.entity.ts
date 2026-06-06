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
import { Project } from './project.entity';
import { User } from './user.entity';
import { CandidatePosition } from './candidate-position.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'text' })
  requirements: string;

  @Column({ name: 'salary_range', nullable: true })
  salaryRange: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'simple-enum', enum: ['low', 'medium', 'high', 'critical'] })
  urgency: 'low' | 'medium' | 'high' | 'critical';

  @Column({ name: 'required_count' })
  requiredCount: number;

  @Column({ name: 'hired_count', default: 0 })
  hiredCount: number;

  @Column({ name: 'expected_date', type: 'date' })
  expectedDate: Date;

  @Column({ type: 'simple-enum', enum: ['open', 'partial', 'filled', 'closed'] })
  status: 'open' | 'partial' | 'filled' | 'closed';

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => Project, (project) => project.positions)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'creator_id' })
  creatorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @OneToMany(() => CandidatePosition, (cp) => cp.position)
  candidatePositions: CandidatePosition[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
