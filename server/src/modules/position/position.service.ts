import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
      qb.andWhere(
        '(position.positionDuty LIKE :keyword OR position.requirementNumber LIKE :keyword OR project.name LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }

    qb.orderBy('position.createdAt', 'DESC');
    const positions = await qb.getMany();

    // 为每个岗位附加候选人统计
    const positionIds = positions.map((p) => p.id);
    if (positionIds.length > 0) {
      const stats = await this.candidatePositionRepository
        .createQueryBuilder('cp')
        .select('cp.positionId', 'positionId')
        .addSelect('COUNT(*)', 'recommendedCount')
        .addSelect(
          "SUM(CASE WHEN cp.status = 'interview_passed' THEN 1 ELSE 0 END)",
          'hiredCount',
        )
        .where('cp.positionId IN (:...ids)', { ids: positionIds })
        .groupBy('cp.positionId')
        .getRawMany();

      const statsMap = new Map(
        stats.map((s) => [Number(s.positionId), s]),
      );

      for (const pos of positions) {
        const s = statsMap.get(pos.id);
        (pos as any).recommendedCount = s
          ? Number(s.recommendedCount)
          : 0;
        // hiredCount 从 candidatePosition 统计覆盖实体默认值
        pos.hiredCount = s ? Number(s.hiredCount) : 0;
        (pos as any).gapCount = Math.max(
          0,
          pos.requiredCount - pos.hiredCount,
        );
      }
    }

    return positions;
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

  async create(data: any, userId: number) {
    const mapped: any = { ...data };
    // 前端 headcount → 后端 requiredCount
    if (mapped.headcount !== undefined) {
      mapped.requiredCount = mapped.headcount;
      delete mapped.headcount;
    }
    // 确保必填字段有默认值（AI导入时可能缺失）
    mapped.systemName = mapped.systemName || '未指定';
    mapped.department = mapped.department || '未指定';
    mapped.requirementNumber = mapped.requirementNumber || '未指定';
    mapped.positionType = mapped.positionType || '未指定';
    mapped.positionDuty = mapped.positionDuty || '未指定';
    mapped.techDomain = mapped.techDomain || '未指定';
    mapped.majorType = mapped.majorType || '未指定';
    mapped.levelDistribution = mapped.levelDistribution || '未指定';
    mapped.requirements = mapped.requirements || '待补充';
    mapped.responsibilities = mapped.responsibilities || '待补充';
    mapped.domainExperience = mapped.domainExperience || '待补充';
    mapped.region = mapped.region || '未指定';
    mapped.deliveryForm = mapped.deliveryForm || '未指定';
    mapped.requiredCount = mapped.requiredCount || 1;
    mapped.projectId = mapped.projectId || data.projectId;
    // 校验 urgency 枚举值
    const validUrgency = ['low', 'medium', 'high', 'critical'];
    if (!mapped.urgency || !validUrgency.includes(mapped.urgency)) {
      mapped.urgency = 'medium';
    }
    // 校验 status 枚举值
    const validStatus = ['open', 'partial', 'filled', 'closed'];
    if (mapped.status && !validStatus.includes(mapped.status)) {
      delete mapped.status;
    }
    const position = this.positionRepository.create(mapped) as unknown as Position;
    position.creatorId = userId;
    const result: any = await this.positionRepository.save(position);
    await this.logService.log(userId, 'create', 'position', result.id, {
      positionDuty: result.positionDuty,
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
      positionDuty: position.positionDuty,
    });
    return { message: '删除成功' };
  }

  async addCandidate(
    positionId: number,
    candidateData: any,
    userId: number,
  ) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    let candidate: Candidate;
    const existingId = candidateData.candidateId || candidateData.id;
    if (existingId) {
      candidate = await this.candidateRepository.findOne({
        where: { id: existingId },
      });
      if (!candidate) {
        throw new NotFoundException('候选人不存在');
      }
    } else {
      candidate = this.candidateRepository.create(candidateData) as unknown as Candidate;
      candidate = await this.candidateRepository.save(candidate);
    }

    // 检查同一岗位是否已推荐同名同电话的候选人
    const existingCP = await this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .where('cp.positionId = :positionId', { positionId })
      .andWhere('candidate.name = :name', { name: candidate.name })
      .getOne();
    if (existingCP) {
      const phoneInfo = candidate.contactPhone ? `（电话: ${candidate.contactPhone}）` : '';
      throw new ConflictException(
        `候选人"${candidate.name}"${phoneInfo}已推荐到该岗位，不可重复推荐`,
      );
    }

    // 获取岗位的对接实施信息
    const positionWithImpl = await this.positionRepository.findOne({
      where: { id: positionId },
    });

    const cp = this.candidatePositionRepository.create({
      candidateId: candidate.id,
      positionId,
      status: 'pending_screen',
      recommendedAt: new Date(),
      pushDate: new Date(),
      recommender: candidateData.recommender || '',
      recommendReason: candidateData.recommendReason || '',
      implementation: positionWithImpl?.positionImplementation || '',
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
