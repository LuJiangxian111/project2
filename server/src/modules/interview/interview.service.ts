import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../../entities/interview.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { LogService } from '../log/log.service';
import { AiService } from '../ai/ai.service';
import { NoticeService } from '../notice/notice.service';
import { SocketGateway } from '../socket/socket.gateway';

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
  ) {}

  async findAll(query?: {
    interviewerId?: number;
    result?: string;
    candidatePositionId?: number;
    projectId?: number;
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
