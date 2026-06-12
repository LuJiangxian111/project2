import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';
import { DiscussionMessage } from './discussion-message.entity';

@Entity('discussion_groups')
export class DiscussionGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'leader_id' })
  leaderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'leader_id' })
  leader: User;

  @Column({ length: 200 })
  name: string;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'discussion_group_members',
    joinColumn: { name: 'group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  members: User[];

  @OneToMany(() => DiscussionMessage, (msg) => msg.group)
  messages: DiscussionMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
