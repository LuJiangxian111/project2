import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('message_board')
export class MessageBoard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, nullable: true })
  nickname: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  visible: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
