import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interview } from '../../entities/interview.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { LogService } from '../log/log.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class InterviewService {
  constructor(
    @InjectRepository(Interview)
    private interviewRepository: Repository<Interview>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    private logService: LogService,
    private aiService: AiService,
  ) {}

  async findAll(query?: {
    interviewerId?: number;
    result?: string;
    candidatePositionId?: number;
  }) {
    const qb = this.interviewRepository
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.interviewer', 'interviewer')
      .leftJoinAndSelect('interview.candidatePosition', 'cp')
      .leftJoinAndSelect('cp.candidate', 'candidate')
      .leftJoinAndSelect('cp.position', 'position');

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
    await this.logService.log(userId, 'create', 'interview', result.id, {
      round: result.round,
      candidatePositionId: result.candidatePositionId,
    });
    return result;
  }

  async update(id: number, data: Partial<Interview>, userId: number) {
    const interview = await this.interviewRepository.findOne({
      where: { id },
    });
    if (!interview) {
      throw new NotFoundException('面试记录不存在');
    }
    Object.assign(interview, data);
    const result = await this.interviewRepository.save(interview);
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
