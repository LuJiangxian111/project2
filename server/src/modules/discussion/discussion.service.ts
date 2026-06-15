import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscussionGroup } from '../../entities/discussion-group.entity';
import { DiscussionMessage } from '../../entities/discussion-message.entity';
import { User } from '../../entities/user.entity';
import { SocketGateway } from '../socket/socket.gateway';

// AI机器人用户名
export const BOT_USERNAME = 'AI助手';
export const BOT_USER_KEY = 'ai_bot_user_id';

@Injectable()
export class DiscussionService {
  constructor(
    @InjectRepository(DiscussionGroup)
    private groupRepository: Repository<DiscussionGroup>,
    @InjectRepository(DiscussionMessage)
    private messageRepository: Repository<DiscussionMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    // 查找用户作为成员的讨论组ID
    const memberRows = await this.groupRepository.manager
      .createQueryBuilder()
      .select('dgm.group_id', 'groupId')
      .from('discussion_group_members', 'dgm')
      .where('dgm.user_id = :userId', { userId })
      .getRawMany();

    const groupIds: number[] = memberRows.map(r => Number(r.groupId));

    // 再加上用户作为leader的讨论组
    const leaderGroups = await this.groupRepository.find({
      where: { leaderId: userId },
      select: ['id'],
    });
    for (const g of leaderGroups) {
      if (!groupIds.includes(g.id)) groupIds.push(g.id);
    }

    if (groupIds.length === 0) return [];

    return this.groupRepository.find({
      where: groupIds.map(id => ({ id })),
      relations: ['leader', 'members', 'project'],
    });
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

  // 解散讨论组（仅创建者可操作）
  async dissolveGroup(groupId: number, userId: number) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'leader'],
    });
    if (!group) {
      throw new NotFoundException('讨论组不存在');
    }

    if (group.leaderId !== userId) {
      throw new ForbiddenException('只有创建者才能解散讨论组');
    }

    // 通知所有成员讨论组已解散
    const memberIds = group.members.map((m) => m.id);
    const allMemberIds = [...new Set([...memberIds, group.leaderId])];
    for (const memberId of allMemberIds) {
      this.socketGateway.broadcastToUser(memberId, 'discussion.dissolved', {
        groupId,
        groupName: group.name,
      });
    }

    // 删除消息和讨论组
    await this.messageRepository.delete({ groupId });
    await this.groupRepository.remove(group);

    return { message: '讨论组已解散' };
  }

  // 确保AI机器人用户存在
  async ensureBotUser(): Promise<number> {
    let bot = await this.userRepository.findOne({ where: { username: 'ai_bot' } });
    if (!bot) {
      bot = this.userRepository.create({
        username: 'ai_bot',
        name: BOT_USERNAME,
        password: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        role: 'admin',
        nickname: BOT_USERNAME,
      });
      bot = await this.userRepository.save(bot);
      console.log(`[DiscussionBot] 创建AI机器人用户, id=${bot.id}`);
    }
    return bot.id;
  }

  // AI机器人发送消息到讨论组（跳过成员验证）
  async sendBotMessage(
    groupId: number,
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
    if (!group) return null;

    const botId = await this.ensureBotUser();

    // 确保机器人是讨论组成员
    const isMember = group.members.some((m) => m.id === botId) || group.leaderId === botId;
    if (!isMember) {
      group.members.push({ id: botId } as any);
      await this.groupRepository.save(group);
    }

    const message = this.messageRepository.create({
      groupId,
      senderId: botId,
      content,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      referenceData: referenceData ? JSON.stringify(referenceData) : null,
      mentionIds: mentionIds && mentionIds.length > 0 ? mentionIds.join(',') : null,
    });

    const result = await this.messageRepository.save(message);

    const savedMessage = await this.messageRepository.findOne({
      where: { id: result.id },
      relations: ['sender'],
    });

    const broadcastData = {
      ...savedMessage,
      mentionIds: savedMessage.mentionIds ? savedMessage.mentionIds.split(',').map(Number) : [],
      referenceData: savedMessage.referenceData ? JSON.parse(savedMessage.referenceData) : null,
      senderName: BOT_USERNAME,
      isBot: true,
    };

    // 向所有组成员广播消息
    const memberIds = group.members.map((m) => m.id);
    const allMemberIds = [...new Set([...memberIds, group.leaderId])];
    for (const memberId of allMemberIds) {
      this.socketGateway.broadcastToUser(memberId, 'discussion.message', broadcastData);
    }

    // 通知被@提及的用户
    if (mentionIds && mentionIds.length > 0) {
      for (const mentionId of mentionIds) {
        if (mentionId !== botId) {
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

  // 根据项目ID发送AI机器人消息
  async sendBotMessageByProject(
    projectId: number,
    content: string,
    mentionIds?: number[],
    referenceType?: string,
    referenceId?: number,
    referenceData?: any,
  ) {
    const group = await this.findByProject(projectId);
    if (!group) return null;
    return this.sendBotMessage(group.id, content, mentionIds, referenceType, referenceId, referenceData);
  }
}
