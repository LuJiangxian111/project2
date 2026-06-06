import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CandidatePosition } from './candidate-position.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'resume_url', nullable: true })
  resumeUrl: string;

  @Column({ name: 'resume_text', type: 'text', nullable: true })
  resumeText: string;

  @Column({ nullable: true })
  source: string;

  @Column({ name: 'years_of_experience', nullable: true })
  yearsOfExperience: number;

  @Column({ name: 'current_company', nullable: true })
  currentCompany: string;

  @Column({ type: 'text', nullable: true })
  skills: string;

  @Column({ nullable: true })
  education: string;

  @OneToMany(() => CandidatePosition, (cp) => cp.candidate)
  candidatePositions: CandidatePosition[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
