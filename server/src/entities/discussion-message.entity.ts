import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { DiscussionGroup } from './discussion-group.entity';

@Entity('discussion_messages')
export class DiscussionMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id' })
  groupId: number;

  @ManyToOne(() => DiscussionGroup, (group) => group.messages)
  @JoinColumn({ name: 'group_id' })
  group: DiscussionGroup;

  @Column({ name: 'sender_id' })
  senderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  content: string;

  // 引用类型: position, candidate, resume, interview
  @Column({ name: 'reference_type', length: 50, nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  @Column({ name: 'reference_data', type: 'text', nullable: true })
  referenceData: string; // 引用项的JSON字符串

  // @提及的用户ID列表，逗号分隔
  @Column({ name: 'mention_ids', type: 'text', nullable: true })
  mentionIds: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
