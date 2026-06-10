import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from '../../entities/position.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { LogService } from '../log/log.service';
import { SocketGateway } from '../socket/socket.gateway';
import { NoticeService } from '../notice/notice.service';

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
    private socketGateway: SocketGateway,
    private noticeService: NoticeService,
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

    const positionIds = positions.map((p) => p.id);
    if (positionIds.length > 0) {
      const stats = await this.candidatePositionRepository
        .createQueryBuilder('cp')
        .select('cp.positionId', 'positionId')
        .addSelect('COUNT(*)', 'recommendedCount')
        .addSelect(
          "SUM(CASE WHEN cp.status = 'onboarded' THEN 1 ELSE 0 END)",
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

  async findByRequirementNumber(requirementNumber: string, projectId: number) {
    return this.positionRepository.findOne({
      where: { requirementNumber, projectId },
    });
  }

  async create(data: any, userId: number) {
    const mapped: any = { ...data };
    if (mapped.headcount !== undefined) {
      mapped.requiredCount = mapped.headcount;
      delete mapped.headcount;
    }
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
    const validUrgency = ['low', 'medium', 'high', 'critical'];
    if (!mapped.urgency || !validUrgency.includes(mapped.urgency)) {
      console.log(`[Position] create: invalid urgency "${mapped.urgency}", fallback to "medium"`);
      mapped.urgency = 'medium';
    }
    const validStatus = ['open', 'partial', 'filled', 'closed'];
    if (!mapped.status || !validStatus.includes(mapped.status)) {
      mapped.status = 'open';
    }
    const entityColumns = [
      'systemName', 'department', 'requirementNumber', 'positionType', 'positionDuty',
      'techDomain', 'majorType', 'levelDistribution', 'salaryRange', 'requirements',
      'responsibilities', 'domainExperience', 'region', 'deliveryForm',
      'positionImplementation', 'urgency', 'requiredCount', 'hiredCount',
      'expectedDate', 'status', 'projectId', 'creatorId',
    ];
    const cleaned: any = {};
    for (const key of entityColumns) {
      if (mapped[key] !== undefined) {
        // 空字符串的日期字段转为 null，避免 MySQL 报错
        if (key === 'expectedDate' && (mapped[key] === '' || mapped[key] === null)) {
          cleaned[key] = null;
        } else {
          cleaned[key] = mapped[key];
        }
      }
    }
    cleaned.creatorId = userId;
    console.log(`[Position] create: urgency=${cleaned.urgency}, status=${cleaned.status}, requirementNumber=${cleaned.requirementNumber}`);
    const position = this.positionRepository.create(cleaned) as unknown as Position;
    if (!validUrgency.includes(position.urgency)) {
      position.urgency = 'medium' as any;
    }
    if (!validStatus.includes(position.status as any)) {
      position.status = 'open' as any;
    }
    const result: any = await this.positionRepository.save(position);
    await this.logService.log(userId, 'create', 'position', result.id, {
      positionDuty: result.positionDuty,
    });
    this.socketGateway.broadcastToAllUsers('position.created', result);
    return result;
  }

  async update(id: number, data: any, userId: number) {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }
    const validUrgency = ['low', 'medium', 'high', 'critical'];
    if (data.urgency && !validUrgency.includes(data.urgency)) {
      console.log(`[Position] update: invalid urgency "${data.urgency}", fallback to "medium"`);
      data.urgency = 'medium';
    }
    const validStatus = ['open', 'partial', 'filled', 'closed'];
    if (data.status && !validStatus.includes(data.status)) {
      console.log(`[Position] update: invalid status "${data.status}", fallback to "open"`);
      data.status = 'open';
    }
    const entityColumns = [
      'systemName', 'department', 'requirementNumber', 'positionType', 'positionDuty',
      'techDomain', 'majorType', 'levelDistribution', 'salaryRange', 'requirements',
      'responsibilities', 'domainExperience', 'region', 'deliveryForm',
      'positionImplementation', 'urgency', 'requiredCount', 'hiredCount',
      'expectedDate', 'status', 'projectId', 'creatorId',
    ];
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      if (entityColumns.includes(key)) {
        // 空字符串的日期字段转为 null，避免 MySQL 报错
        if (key === 'expectedDate' && (data[key] === '' || data[key] === null)) {
          cleaned[key] = null;
        } else {
          cleaned[key] = data[key];
        }
      }
    }
    Object.assign(position, cleaned);
    if (!validUrgency.includes(position.urgency)) {
      position.urgency = 'medium' as any;
    }
    if (!position.status || !validStatus.includes(position.status as any)) {
      position.status = 'open' as any;
    }
    console.log(`[Position] update id=${id}: urgency=${position.urgency}, status=${position.status}`);
    const result = await this.positionRepository.save(position);
    await this.logService.log(userId, 'update', 'position', id, cleaned);
    this.socketGateway.broadcastToAllUsers('position.updated', result);
    return result;
  }

  async batchUpdate(ids: number[], data: Partial<any>, userId: number) {
    if (!ids || ids.length === 0) {
      throw new NotFoundException('请选择要编辑的岗位');
    }
    const validUrgency = ['low', 'medium', 'high', 'critical'];
    const validStatus = ['open', 'partial', 'filled', 'closed'];
    if (data.urgency && !validUrgency.includes(data.urgency)) {
      delete data.urgency;
    }
    if (data.status && !validStatus.includes(data.status)) {
      delete data.status;
    }
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const position = await this.positionRepository.findOne({ where: { id } });
        if (!position) {
          failed++;
          continue;
        }
        Object.assign(position, data);
        await this.positionRepository.save(position);
        success++;
      } catch {
        failed++;
      }
    }
    await this.logService.log(userId, 'batch_update', 'position', null, {
      ids,
      data,
      success,
      failed,
    });
    this.socketGateway.broadcastToAllUsers('position.batchUpdated', { ids, data, success, failed });
    return { success, failed };
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
    this.socketGateway.broadcastToAllUsers('position.deleted', { id });
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
      recommenderId: userId,
      recommendReason: candidateData.recommendReason || '',
      implementation: positionWithImpl?.positionImplementation || '',
    });
    const result = await this.candidatePositionRepository.save(cp);
    await this.logService.log(userId, 'add_candidate', 'position', positionId, {
      candidateId: candidate.id,
      candidateName: candidate.name,
    });
    this.socketGateway.broadcastToAllUsers('candidate.added', { positionId, candidateId: candidate.id, candidateName: candidate.name });

    // 通知岗位上传者
    if (position.creatorId && position.creatorId !== userId) {
      this.noticeService.createSystemNotice(
        '新候选人推荐',
        `${candidateData.recommender || '有人'}向您的岗位「${position.positionDuty}」推荐了候选人「${candidate.name}」`,
        position.creatorId,
      ).catch(() => {});
    }

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