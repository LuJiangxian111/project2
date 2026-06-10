import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../../entities/candidate.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Position } from '../../entities/position.entity';
import { LogService } from '../log/log.service';
import { AiService } from '../ai/ai.service';
import { SocketGateway } from '../socket/socket.gateway';

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
    private socketGateway: SocketGateway,
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

  async findAllWithPositions(query?: {
    keyword?: string;
    projectId?: number;
    positionId?: number;
    status?: string;
  }) {
    const qb = this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .innerJoinAndSelect('cp.position', 'position')
      .leftJoinAndSelect('position.project', 'project');

    if (query?.keyword) {
      qb.andWhere(
        '(candidate.name LIKE :keyword OR candidate.contactPhone LIKE :keyword OR candidate.idNumber LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }
    if (query?.projectId) {
      qb.andWhere('position.projectId = :projectId', {
        projectId: query.projectId,
      });
    }
    if (query?.positionId) {
      qb.andWhere('cp.positionId = :positionId', {
        positionId: query.positionId,
      });
    }
    if (query?.status) {
      qb.andWhere('cp.status = :status', { status: query.status });
    }

    qb.orderBy('candidate.name', 'ASC').addOrderBy('cp.recommendedAt', 'DESC');

    const results = await qb.getMany();

    const groupMap = new Map<string, any[]>();
    for (const cp of results) {
      const key = `${cp.candidate.name}||${cp.candidate.contactPhone || ''}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(cp);
    }

    const groups = Array.from(groupMap.entries()).map(([key, items]) => {
      const [name, phone] = key.split('||');
      const firstCandidate = items[0]?.candidate;
      const candidateIds = [...new Set(items.map((i) => i.candidateId))];
      return {
        name,
        phone: phone || undefined,
        candidateIds,
        idType: firstCandidate?.idType,
        idNumber: firstCandidate?.idNumber,
        gender: firstCandidate?.gender,
        contactPhone: firstCandidate?.contactPhone,
        contactEmail: firstCandidate?.contactEmail,
        areaCode: firstCandidate?.areaCode,
        educationType: firstCandidate?.educationType,
        education: firstCandidate?.education,
        graduationDate: firstCandidate?.graduationDate,
        domainYears: firstCandidate?.domainYears,
        workStatus: firstCandidate?.workStatus,
        expectedSalary: firstCandidate?.expectedSalary,
        supplier: firstCandidate?.supplier,
        resumeUrl: firstCandidate?.resumeUrl,
        positions: items.map((cp) => ({
          cpId: cp.id,
          candidateId: cp.candidateId,
          positionId: cp.positionId,
          positionTitle: cp.position?.positionDuty,
          positionType: cp.position?.positionType,
          techDomain: cp.position?.techDomain,
          requirementNumber: cp.position?.requirementNumber,
          projectId: cp.position?.projectId,
          projectName: (cp.position as any)?.project?.name,
          status: cp.status,
          matchScore: cp.matchScore,
          recommendReason: cp.recommendReason,
          recommender: cp.recommender,
          pushDate: cp.pushDate,
          implementation: cp.implementation,
          resumeUrl: cp.resumeUrl,
          recommendedAt: cp.recommendedAt,
          updatedAt: cp.updatedAt,
        })),
      };
    });

    return groups;
  }

  async updateCandidatePositionStatus(
    cpId: number,
    status: string,
    userId: number,
  ) {
    const cp = await this.candidatePositionRepository.findOne({
      where: { id: cpId },
      relations: ['candidate', 'position'],
    });
    if (!cp) {
      throw new NotFoundException('候选人岗位关联不存在');
    }
    const oldStatus = cp.status;
    cp.status = status as any;
    const result = await this.candidatePositionRepository.save(cp);

    if (status === 'onboarded' && oldStatus !== 'onboarded' && cp.position) {
      const pos = await this.positionRepository.findOneBy({ id: cp.position.id });
      if (pos) {
        pos.hiredCount = (pos.hiredCount || 0) + 1;
        await this.positionRepository.save(pos);
      }
    } else if (status !== 'onboarded' && oldStatus === 'onboarded' && cp.position) {
      const pos = await this.positionRepository.findOneBy({ id: cp.position.id });
      if (pos) {
        pos.hiredCount = Math.max(0, (pos.hiredCount || 0) - 1);
        await this.positionRepository.save(pos);
      }
    }

    await this.logService.log(userId, 'update_status', 'candidate_position', cpId, {
      candidateName: cp.candidate?.name,
      positionTitle: cp.position?.positionDuty,
      newStatus: status,
    });
    this.socketGateway.broadcastToAllUsers('candidate.statusUpdated', { cpId, status, candidateName: cp.candidate?.name });
    return result;
  }

  async findOne(id: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { id },
      relations: ['candidatePositions', 'candidatePositions.position', 'candidatePositions.position.project'],
    });
    if (!candidate) {
      throw new NotFoundException('候选人不存在');
    }

    const samePersonCandidates = await this.candidateRepository.find({
      where: [
        { name: candidate.name, contactPhone: candidate.contactPhone || '' },
      ],
      relations: ['candidatePositions', 'candidatePositions.position', 'candidatePositions.position.project'],
    });

    const allPositions: any[] = [];
    const seenCpIds = new Set<number>();
    for (const c of samePersonCandidates) {
      for (const cp of c.candidatePositions || []) {
        if (!seenCpIds.has(cp.id)) {
          seenCpIds.add(cp.id);
          allPositions.push(cp);
        }
      }
    }

    return {
      ...candidate,
      candidatePositions: allPositions,
    };
  }

  async create(data: Partial<Candidate>, userId: number) {
    const candidate = this.candidateRepository.create(data);
    const result = await this.candidateRepository.save(candidate);
    await this.logService.log(userId, 'create', 'candidate', result.id, {
      name: result.name,
    });
    this.socketGateway.broadcastToAllUsers('candidate.created', result);
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
    this.socketGateway.broadcastToAllUsers('candidate.updated', result);
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
    this.socketGateway.broadcastToAllUsers('candidate.deleted', { id, name: candidate.name });
    return { message: '删除成功' };
  }

  async findCandidatesWithResume(projectId?: number, positionId?: number) {
    if (positionId) {
      // 按岗位筛选：从 candidate_positions 获取候选人，同时获取候选人自身的 resumeUrl 和关联的 resumeUrl
      const cps = await this.candidatePositionRepository.find({
        where: { positionId },
        relations: ['candidate'],
      });
      return cps
        .filter(cp => cp.candidate?.resumeUrl || cp.resumeUrl)
        .map(cp => ({
          id: cp.candidateId,
          name: cp.candidate?.name || '未知',
          resumeUrl: cp.candidate?.resumeUrl || cp.resumeUrl,
        }));
    }

    if (projectId) {
      // 按项目筛选：先找项目下的岗位，再找候选人
      const positions = await this.positionRepository.find({ where: { projectId } });
      const positionIds = positions.map(p => p.id);
      if (positionIds.length === 0) return [];
      const cps = await this.candidatePositionRepository.find({
        where: positionIds.map(pid => ({ positionId: pid })),
        relations: ['candidate'],
      });
      return cps
        .filter(cp => cp.candidate?.resumeUrl || cp.resumeUrl)
        .map(cp => ({
          id: cp.candidateId,
          name: cp.candidate?.name || '未知',
          resumeUrl: cp.candidate?.resumeUrl || cp.resumeUrl,
        }));
    }

    // 无筛选：所有有简历的候选人
    const candidates = await this.candidateRepository.find();
    return candidates
      .filter(c => c.resumeUrl)
      .map(c => ({ id: c.id, name: c.name, resumeUrl: c.resumeUrl }));
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
        status: 'pending_screen',
        recommendedAt: new Date(),
      });
      await this.candidatePositionRepository.save(cp);
    }

    await this.logService.log(userId, 'match', 'candidate', candidateId, {
      positionId,
      score: matchResult.score,
    });

    this.socketGateway.broadcastToAllUsers('candidate.matched', { candidateId, positionId, score: matchResult.score });

    return {
      candidate,
      position,
      matchScore: matchResult.score,
      matchDetail: matchResult.detail,
      candidatePosition: cp,
    };
  }
}