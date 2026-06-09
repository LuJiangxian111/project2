import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'key_hash', unique: true, length: 255 })
  keyHash: string;

  @Column({ name: 'key_prefix', length: 12 })
  keyPrefix: string;

  @Column({ length: 100 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
