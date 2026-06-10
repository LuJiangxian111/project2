import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

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

  @Column({ name: 'parent_id', nullable: true })
  parentId: number;

  @ManyToOne(() => MessageBoard, (msg) => msg.replies)
  @JoinColumn({ name: 'parent_id' })
  parent: MessageBoard;

  @OneToMany(() => MessageBoard, (msg) => msg.parent)
  replies: MessageBoard[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
