import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../../entities/position.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { LogService } from '../log/log.service';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    @InjectRepository(Candidate)
    private candidateRepository: Repository<Candidate>,
    private logService: LogService,
  ) {}

  async findAll(query?: {
    status?: string;
    urgency?: string;
    projectId?: number;
    keyword?: string;
  }) {
    const qb = this.positionRepository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.project', 'project')
      .leftJoinAndSelect('position.creator', 'creator');

    if (query?.status) {
      qb.andWhere('position.status = :status', { status: query.status });
    }
    if (query?.urgency) {
      qb.andWhere('position.urgency = :urgency', { urgency: query.urgency });
    }
    if (query?.projectId) {
      qb.andWhere('position.projectId = :projectId', {
        projectId: query.projectId,
      });
    }
    if (query?.keyword) {
      qb.andWhere('position.title LIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }

    qb.orderBy('position.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number) {
    const position = await this.positionRepository.findOne({
      where: { id },
      relations: ['project', 'creator'],
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }
    return position;
  }

  async create(data: Partial<Position>, userId: number) {
    const position = this.positionRepository.create(data);
    position.creatorId = userId;
    const result = await this.positionRepository.save(position);
    await this.logService.log(userId, 'create', 'position', result.id, {
      title: result.title,
    });
    return result;
  }

  async update(id: number, data: Partial<Position>, userId: number) {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }
    Object.assign(position, data);
    const result = await this.positionRepository.save(position);
    await this.logService.log(userId, 'update', 'position', id, data);
    return result;
  }

  async remove(id: number, userId: number) {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }
    await this.positionRepository.remove(position);
    await this.logService.log(userId, 'delete', 'position', id, {
      title: position.title,
    });
    return { message: '删除成功' };
  }

  async addCandidate(
    positionId: number,
    candidateData: Partial<Candidate>,
    userId: number,
  ) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    let candidate: Candidate;
    if (candidateData.id) {
      candidate = await this.candidateRepository.findOne({
        where: { id: candidateData.id },
      });
      if (!candidate) {
        throw new NotFoundException('候选人不存在');
      }
    } else {
      candidate = this.candidateRepository.create(candidateData);
      candidate = await this.candidateRepository.save(candidate);
    }

    const existing = await this.candidatePositionRepository.findOne({
      where: { candidateId: candidate.id, positionId },
    });
    if (existing) {
      return existing;
    }

    const cp = this.candidatePositionRepository.create({
      candidateId: candidate.id,
      positionId,
      status: 'recommended',
      recommendedAt: new Date(),
    });
    const result = await this.candidatePositionRepository.save(cp);
    await this.logService.log(userId, 'add_candidate', 'position', positionId, {
      candidateId: candidate.id,
      candidateName: candidate.name,
    });
    return result;
  }

  async getCandidates(positionId: number) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    const candidatePositions = await this.candidatePositionRepository.find({
      where: { positionId },
      relations: ['candidate'],
      order: { matchScore: 'DESC' },
    });
    return candidatePositions;
  }
}
