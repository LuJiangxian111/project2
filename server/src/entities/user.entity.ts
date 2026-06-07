import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './project.entity';
import { Interview } from './interview.entity';
import { AuditLog } from './audit-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'simple-enum', enum: ['admin', 'hr', 'pm', 'interviewer'], default: 'hr' })
  role: 'admin' | 'hr' | 'pm' | 'interviewer';

  @Column({ nullable: true })
  avatar: string;

  @Column({ name: 'llm_api_key', nullable: true })
  llmApiKey: string;

  @Column({ name: 'llm_base_url', nullable: true })
  llmBaseUrl: string;

  @Column({ name: 'llm_model', nullable: true })
  llmModel: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Project, (project) => project.manager)
  managedProjects: Project[];

  @OneToMany(() => Interview, (interview) => interview.interviewer)
  interviews: Interview[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];
}
