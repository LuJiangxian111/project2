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

  @Column({ name: 'system_name', length: 100 })
  systemName: string;

  @Column({ length: 100 })
  department: string;

  @Column({ name: 'requirement_number', length: 100 })
  requirementNumber: string;

  @Column({ name: 'position_type', length: 100 })
  positionType: string;

  @Column({ name: 'position_duty', length: 200 })
  positionDuty: string;

  @Column({ name: 'tech_domain', length: 100 })
  techDomain: string;

  @Column({ name: 'major_type', length: 100 })
  majorType: string;

  @Column({ name: 'level_distribution', length: 100 })
  levelDistribution: string;

  @Column({ name: 'salary_range', nullable: true, length: 100 })
  salaryRange: string;

  @Column({ type: 'text' })
  requirements: string;

  @Column({ type: 'text' })
  responsibilities: string;

  @Column({ name: 'domain_experience', type: 'text' })
  domainExperience: string;

  @Column({ length: 100 })
  region: string;

  @Column({ name: 'delivery_form', length: 100 })
  deliveryForm: string;

  @Column({ name: 'position_implementation', type: 'text', nullable: true })
  positionImplementation: string;

  @Column({ type: 'simple-enum', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  urgency: 'low' | 'medium' | 'high' | 'critical';

  @Column({ name: 'required_count', default: 1 })
  requiredCount: number;

  @Column({ name: 'hired_count', default: 0 })
  hiredCount: number;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: Date;

  @Column({ type: 'simple-enum', enum: ['open', 'partial', 'filled', 'closed'], default: 'open' })
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
