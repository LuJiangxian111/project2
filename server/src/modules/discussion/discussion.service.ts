import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscussionGroup } from '../../entities/discussion-group.entity';
import { DiscussionMessage } from '../../entities/discussion-message.entity';
import { SocketGateway } from '../socket/socket.gateway';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(DiscussionGroup)
    private groupRepository: Repository<DiscussionGroup>,
    @InjectRepository(DiscussionMessage)
    private messageRepository: Repository<DiscussionMessage>,
    private socketGateway: SocketGateway,
  ) {}

  // 根据项目ID获取讨论组
  async findByProject(projectId: number) {
    const group = await this.groupRepository.findOne({
      where: { projectId },
      relations: ['leader', 'members', 'project'],
    });
    return group;
  }

  // 获取用户所属的所有讨论组
  async findByUser(userId: number) {
    const groups = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.members', 'member')
      .leftJoinAndSelect('group.leader', 'leader')
      .leftJoinAndSelect('group.project', 'project')
      .where('member.id = :userId', { userId })
      .orWhere('group.leaderId = :userId', { userId })
      .getMany();
    return groups;
  }

  // 为项目创建讨论组
  async createForProject(projectId: number, leaderId: number, name: string) {
    // 检查是否已存在讨论组
    const existing = await this.groupRepository.findOne({
      where: { projectId },
    });
    if (existing) {
      return existing;
    }

    const group = this.groupRepository.create({
      projectId,
      leaderId,
      name,
      members: [{ id: leaderId } as any], // 创建者自动成为成员
    });
    const result = await this.groupRepository.save(group);
    return this.groupRepository.findOne({
      where: { id: result.id },
      relations: ['leader', 'members', 'project'],
    });
  }

  // 添加成员到讨论组
  async addMember(groupId: number, userId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) {
      throw new NotFoundException('讨论组不存在');
    }

    // 检查是否已是成员
    const isMember = group.members.some((m) => m.id === userId);
    if (isMember) {
      return group; // 已是成员，直接返回
    }

    group.members.push({ id: userId } as any);
    await this.groupRepository.save(group);

    // 通知用户被添加到讨论组
    this.socketGateway.broadcastToUser(userId, 'discussion.memberAdded', {
      groupId,
      groupName: group.name,
    });

    return this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['leader', 'members', 'project'],
    });
  }

  // 从讨论组移除成员
  async removeMember(groupId: number, userId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) {
      throw new NotFoundException('讨论组不存在');
    }

    // 组长不能被移除
    if (group.leaderId === userId) {
      throw new ForbiddenException('不能移除组长');
    }

    group.members = group.members.filter((m) => m.id !== userId);
    await this.groupRepository.save(group);

    // 通知用户被移除
    this.socketGateway.broadcastToUser(userId, 'discussion.memberRemoved', {
      groupId,
      groupName: group.name,
    });

    return { message: '移除成功' };
  }

  // 获取讨论组消息（分页）
  async getMessages(groupId: number, limit: number = 50, before?: number) {
    const qb = this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .where('msg.groupId = :groupId', { groupId })
      .orderBy('msg.createdAt', 'DESC')
      .limit(limit);

    if (before) {
      qb.andWhere('msg.id < :before', { before });
    }

    const messages = await qb.getMany();
    // 解析referenceData JSON字符串
    return messages.reverse().map((msg: any) => ({
      ...msg,
      referenceData: msg.referenceData ? JSON.parse(msg.referenceData) : null,
      mentionIds: msg.mentionIds ? msg.mentionIds.split(',').map(Number) : [],
      senderName: msg.sender?.nickname || msg.sender?.name || msg.sender?.username || `用户${msg.senderId}`,
    }));
  }

  // 发送消息并广播
  async sendMessage(
    groupId: number,
    senderId: number,
    content: string,
    mentionIds?: number[],
    referenceType?: string,
    referenceId?: number,
    referenceData?: any,
  ) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members'],
    });
    if (!group) {
      throw new NotFoundException('讨论组不存在');
    }

    // 验证发送者是否是组成员
    const isMember =
      group.members.some((m) => m.id === senderId) ||
      group.leaderId === senderId;
    if (!isMember) {
      throw new ForbiddenException('您不是该讨论组成员');
    }

    const message = this.messageRepository.create({
      groupId,
      senderId,
      content,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      referenceData: referenceData ? JSON.stringify(referenceData) : null,
      mentionIds: mentionIds && mentionIds.length > 0
        ? mentionIds.join(',')
        : null,
    });

    const result = await this.messageRepository.save(message);

    // 加载发送者信息
    const savedMessage = await this.messageRepository.findOne({
      where: { id: result.id },
      relations: ['sender'],
    });

    // 构建广播数据
    const broadcastData = {
      ...savedMessage,
      mentionIds: savedMessage.mentionIds
        ? savedMessage.mentionIds.split(',').map(Number)
        : [],
      referenceData: savedMessage.referenceData
        ? JSON.parse(savedMessage.referenceData)
        : null,
    };

    // 向所有组成员广播消息
    const memberIds = group.members.map((m) => m.id);
    const allMemberIds = [...memberIds, group.leaderId];
    const uniqueMemberIds = [...new Set(allMemberIds)];

    for (const memberId of uniqueMemberIds) {
      this.socketGateway.broadcastToUser(
        memberId,
        'discussion.message',
        broadcastData,
      );
    }

    // 特别通知被@提及的用户
    if (mentionIds && mentionIds.length > 0) {
      for (const mentionId of mentionIds) {
        if (mentionId !== senderId) {
          this.socketGateway.broadcastToUser(mentionId, 'discussion.mentioned', {
            groupId,
            groupName: group.name,
            message: broadcastData,
          });
        }
      }
    }

    return broadcastData;
  }

  // 获取讨论组成员
  async getMembers(groupId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'leader'],
    });
    if (!group) {
      throw new NotFoundException('讨论组不存在');
    }
    return {
      leader: group.leader,
      members: group.members,
    };
  }
}
