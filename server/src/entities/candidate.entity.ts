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

  @Column({ name: 'id_type', length: 50, nullable: true })
  idType: string;

  @Column({ name: 'id_number', length: 100, nullable: true })
  idNumber: string;

  @Column({ length: 10, nullable: true })
  gender: string;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone: string;

  @Column({ name: 'contact_email', length: 200, nullable: true })
  contactEmail: string;

  @Column({ name: 'area_code', length: 20, nullable: true })
  areaCode: string;

  @Column({ name: 'education_type', length: 50, nullable: true })
  educationType: string;

  @Column({ length: 50, nullable: true })
  education: string;

  @Column({ name: 'graduation_date', type: 'date', nullable: true })
  graduationDate: Date;

  @Column({ name: 'domain_years', nullable: true })
  domainYears: number;

  @Column({ name: 'work_status', length: 50, nullable: true })
  workStatus: string;

  @Column({ name: 'expected_salary', length: 100, nullable: true })
  expectedSalary: string;

  @Column({ name: 'supplier', length: 200, nullable: true })
  supplier: string;

  @Column({ name: 'resume_url', nullable: true })
  resumeUrl: string;

  @Column({ name: 'resume_text', type: 'text', nullable: true })
  resumeText: string;

  @OneToMany(() => CandidatePosition, (cp) => cp.candidate)
  candidatePositions: CandidatePosition[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
