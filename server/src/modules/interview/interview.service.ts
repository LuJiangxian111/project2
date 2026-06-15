import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../../entities/interview.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { LogService } from '../log/log.service';
import { AiService } from '../ai/ai.service';
import { NoticeService } from '../notice/notice.service';
import { SocketGateway } from '../socket/socket.gateway';
import { DiscussionService } from '../discussion/discussion.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(Interview)
    private interviewRepository: Repository<Interview>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    private logService: LogService,
    private aiService: AiService,
    private noticeService: NoticeService,
    private socketGateway: SocketGateway,
    private discussionService: DiscussionService,
  ) {}

  async findAll(query?: {
    interviewerId?: number;
    result?: string;
    candidatePositionId?: number;
    projectId?: number;
    positionId?: number;
  }) {
    const qb = this.interviewRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.interviewer', 'interviewer')
      .leftJoinAndSelect('interview.candidatePosition', 'cp')
      .leftJoinAndSelect('cp.candidate', 'candidate')
      .leftJoinAndSelect('cp.position', 'position')
      .leftJoinAndSelect('position.project', 'project');

    if (query?.interviewerId) {
      qb.andWhere('interview.interviewerId = :interviewerId', {
        interviewerId: query.interviewerId,
      });
    }
    if (query?.result) {
      qb.andWhere('interview.result = :result', { result: query.result });
    }
    if (query?.candidatePositionId) {
      qb.andWhere('interview.candidatePositionId = :candidatePositionId', {
        candidatePositionId: query.candidatePositionId,
      });
    }
    if (query?.projectId) {
      qb.andWhere('position.projectId = :projectId', { projectId: query.projectId });
    }
    if (query?.positionId) {
      qb.andWhere('cp.positionId = :positionId', { positionId: query.positionId });
    }

    qb.orderBy('interview.scheduledAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number) {
    const interview = await this.interviewRepository.findOne({
      where: { id },
      relations: [
        'interviewer',
        'candidatePosition',
        'candidatePosition.candidate',
        'candidatePosition.position',
      ],
    });
    if (!interview) {
      throw new NotFoundException('面试记录不存在');
    }
    return interview;
  }

  async create(data: Partial<Interview>, userId: number) {
    const interview = this.interviewRepository.create(data);
    const result = await this.interviewRepository.save(interview);

    // 同步候选人状态为待面试
    if (result.candidatePositionId) {
      const cp = await this.candidatePositionRepository.findOne({
        where: { id: result.candidatePositionId },
        relations: ['candidate', 'position', 'position.creator'],
      });
      if (cp && cp.status !== 'pending_interview') {
        cp.status = 'pending_interview';
        await this.candidatePositionRepository.save(cp);
        this.socketGateway.broadcastToAllUsers('candidate_position.updated', {
          id: cp.id,
          status: 'pending_interview',
        });

        // 通知候选人上传者
        if (cp.recommenderId) {
          try {
            await this.noticeService.create({
              title: '面试安排通知',
              content: `候选人 ${cp.candidate?.name || '未知'} 已安排面试，岗位：${cp.position?.positionDuty || '未知'}，面试时间：${result.scheduledAt ? new Date(result.scheduledAt).toLocaleString('zh-CN') : '待定'}`,
              authorId: userId,
              targetUserId: cp.recommenderId,
            }, userId);
          } catch (err) {
            console.error('[Interview] 通知发送失败:', err?.message || err);
          }
        }
      }
    }

    await this.logService.log(userId, 'create', 'interview', result.id, {
      round: result.round,
      candidatePositionId: result.candidatePositionId,
    });

    // AI机器人通知讨论组：新面试安排
    try {
      const cp = await this.candidatePositionRepository.findOne({
        where: { id: result.candidatePositionId },
        relations: ['candidate', 'position'],
      });
      if (cp?.position?.projectId) {
        const mentionIds: number[] = [];
        if (result.interviewerId) mentionIds.push(result.interviewerId);
        if (cp.recommenderId) mentionIds.push(cp.recommenderId);
        const timeStr = result.scheduledAt ? new Date(result.scheduledAt).toLocaleString('zh-CN') : '待定';
        await this.discussionService.sendBotMessageByProject(
          cp.position.projectId,
          `📅 面试安排：候选人「${cp.candidate?.name || '未知'}」已安排面试，岗位「${cp.position?.positionDuty || '未知'}」，时间：${timeStr}`,
          mentionIds,
          'interview',
          result.id,
          { id: result.id, candidateName: cp.candidate?.name, positionDuty: cp.position?.positionDuty, scheduledAt: result.scheduledAt },
        );
      }
    } catch (err) {
      console.error('[Interview] AI机器人通知失败:', err?.message || err);
    }

    return result;
  }

  async update(id: number, data: Partial<Interview>, userId: number) {
    const interview = await this.interviewRepository.findOne({
      where: { id },
      relations: ['candidatePosition', 'candidatePosition.candidate', 'candidatePosition.position'],
    });
    if (!interview) {
      throw new NotFoundException('面试记录不存在');
    }

    Object.assign(interview, data);
    const result = await this.interviewRepository.save(interview);

    // 面试结果同步到候选人状态
    if (data.result && data.result !== 'pending') {
      const cp = interview.candidatePosition;
      if (cp) {
        let newStatus: string | null = null;
        if (data.result === 'pass') {
          newStatus = 'interview_passed';
        } else if (data.result === 'fail') {
          newStatus = 'interview_rejected';
        } else if (data.result === 'cancel') {
          newStatus = 'abandoned';
        }
        if (newStatus) {
          cp.status = newStatus as any;
          await this.candidatePositionRepository.save(cp);
          this.socketGateway.broadcastToAllUsers('candidate_position.updated', {
            id: cp.id,
            status: newStatus,
          });

          // 通知候选人上传者
          if (cp.recommenderId) {
            try {
              const statusLabel: Record<string, string> = {
                interview_passed: '面试通过',
                interview_rejected: '面试不通过',
                abandoned: '放弃面试',
              };
              await this.noticeService.create({
                title: '面试结果通知',
                content: `候选人 ${cp.candidate?.name || '未知'} 的面试结果已更新：${statusLabel[newStatus] || newStatus}，岗位：${cp.position?.positionDuty || '未知'}`,
                authorId: userId,
                targetUserId: cp.recommenderId,
              }, userId);
            } catch (err) {
              console.error('[Interview] 通知发送失败:', err?.message || err);
            }
          }
        }
      }
    }

    await this.logService.log(userId, 'update', 'interview', id, data);

    // AI机器人通知讨论组：面试结果更新
    if (data.result && data.result !== 'pending') {
      try {
        const cp = interview.candidatePosition;
        if (cp?.position?.projectId) {
          const statusLabel: Record<string, string> = {
            interview_passed: '面试通过',
            interview_rejected: '面试不通过',
            abandoned: '放弃面试',
          };
          const mentionIds: number[] = [];
          if (cp.recommenderId) mentionIds.push(cp.recommenderId);
          if (interview.interviewerId) mentionIds.push(interview.interviewerId);
          await this.discussionService.sendBotMessageByProject(
            cp.position.projectId,
            `📋 面试结果：候选人「${cp.candidate?.name || '未知'}」${statusLabel[data.result] || data.result}，岗位「${cp.position?.positionDuty || '未知'}」`,
            mentionIds,
            'interview',
            id,
            { id, candidateName: cp.candidate?.name, positionDuty: cp.position?.positionDuty, result: data.result },
          );
        }
      } catch (err) {
        console.error('[Interview] AI机器人通知失败:', err?.message || err);
      }
    }

    return result;
  }

  async generateQuestions(id: number, userId: number) {
    const interview = await this.interviewRepository.findOne({
      where: { id },
      relations: [
        'candidatePosition',
        'candidatePosition.candidate',
        'candidatePosition.position',
      ],
    });
    if (!interview) {
      throw new NotFoundException('面试记录不存在');
    }

    const cp = interview.candidatePosition;
    const questions = await this.aiService.generateInterviewQuestions(
      cp.candidate,
      cp.position,
      interview.round,
      userId,
    );

    interview.aiQuestions = JSON.stringify(questions);
    await this.interviewRepository.save(interview);

    await this.logService.log(
      userId,
      'generate_questions',
      'interview',
      id,
      { round: interview.round },
    );

    return questions;
  }
}
