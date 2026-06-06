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
import { User } from './user.entity';
import { Position } from './position.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'simple-enum', enum: ['planning', 'active', 'completed', 'paused'] })
  status: 'planning' | 'active' | 'completed' | 'paused';

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ name: 'manager_id', nullable: true })
  managerId: number;

  @ManyToOne(() => User, (user) => user.managedProjects)
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @OneToMany(() => Position, (position) => position.project)
  positions: Position[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
