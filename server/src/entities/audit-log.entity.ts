import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.auditLogs)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId: number;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
