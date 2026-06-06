import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../../entities/candidate.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Position } from '../../entities/position.entity';
import { LogService } from '../log/log.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class CandidateService {
  constructor(
    @InjectRepository(Candidate)
    private candidateRepository: Repository<Candidate>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private logService: LogService,
    private aiService: AiService,
  ) {}

  async findAll(query?: { keyword?: string; source?: string }) {
    const qb = this.candidateRepository.createQueryBuilder('candidate');

    if (query?.keyword) {
      qb.andWhere(
        '(candidate.name LIKE :keyword OR candidate.email LIKE :keyword OR candidate.phone LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }
    if (query?.source) {
      qb.andWhere('candidate.source = :source', { source: query.source });
    }

    qb.orderBy('candidate.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { id },
      relations: ['candidatePositions', 'candidatePositions.position'],
    });
    if (!candidate) {
      throw new NotFoundException('候选人不存在');
    }
    return candidate;
  }

  async create(data: Partial<Candidate>, userId: number) {
    const candidate = this.candidateRepository.create(data);
    const result = await this.candidateRepository.save(candidate);
    await this.logService.log(userId, 'create', 'candidate', result.id, {
      name: result.name,
    });
    return result;
  }

  async update(id: number, data: Partial<Candidate>, userId: number) {
    const candidate = await this.candidateRepository.findOne({ where: { id } });
    if (!candidate) {
      throw new NotFoundException('候选人不存在');
    }
    Object.assign(candidate, data);
    const result = await this.candidateRepository.save(candidate);
    await this.logService.log(userId, 'update', 'candidate', id, data);
    return result;
  }

  async remove(id: number, userId: number) {
    const candidate = await this.candidateRepository.findOne({ where: { id } });
    if (!candidate) {
      throw new NotFoundException('候选人不存在');
    }
    await this.candidateRepository.remove(candidate);
    await this.logService.log(userId, 'delete', 'candidate', id, {
      name: candidate.name,
    });
    return { message: '删除成功' };
  }

  async matchWithPosition(
    candidateId: number,
    positionId: number,
    userId: number,
  ) {
    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException('候选人不存在');
    }

    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    const matchResult = await this.aiService.matchCandidate(
      candidate,
      position,
      userId,
    );

    let cp = await this.candidatePositionRepository.findOne({
      where: { candidateId, positionId },
    });

    if (cp) {
      cp.matchScore = matchResult.score;
      cp.matchDetail = JSON.stringify(matchResult.detail);
      await this.candidatePositionRepository.save(cp);
    } else {
      cp = this.candidatePositionRepository.create({
        candidateId,
        positionId,
        matchScore: matchResult.score,
        matchDetail: JSON.stringify(matchResult.detail),
        status: 'recommended',
        recommendedAt: new Date(),
      });
      await this.candidatePositionRepository.save(cp);
    }

    await this.logService.log(userId, 'match', 'candidate', candidateId, {
      positionId,
      score: matchResult.score,
    });

    return {
      candidate,
      position,
      matchScore: matchResult.score,
      matchDetail: matchResult.detail,
      candidatePosition: cp,
    };
  }
}
