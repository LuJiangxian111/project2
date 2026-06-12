import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Position } from '../../entities/position.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { LogService } from '../log/log.service';
import { SocketGateway } from '../socket/socket.gateway';
import { NoticeService } from '../notice/notice.service';
import { AiService } from '../ai/ai.service';
import { DiscussionService } from '../discussion/discussion.service';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

// 将Excel日期序列号转换为正常日期字符串
function convertExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    return str.replace(/\//g, '-').substring(0, 10);
  }
  const num = Number(str);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + num * 86400000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    @InjectRepository(Candidate)
    private candidateRepository: Repository<Candidate>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private logService: LogService,
    private socketGateway: SocketGateway,
    private noticeService: NoticeService,
    private aiService: AiService,
    @Inject(forwardRef(() => DiscussionService))
    private discussionService: DiscussionService,
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
        } else if (key === 'expectedDate') {
          // 处理Excel日期序列号
          cleaned[key] = convertExcelDate(mapped[key]);
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

  async batchDelete(ids: number[], userId: number) {
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const position = await this.positionRepository.findOne({ where: { id } });
        if (position) {
          await this.positionRepository.remove(position);
          await this.logService.log(userId, 'batch_delete', 'position', id, {
            positionDuty: position.positionDuty,
          });
          this.socketGateway.broadcastToAllUsers('position.deleted', { id });
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    return { success, failed, total: ids.length, message: `批量删除完成：成功 ${success} 条，失败 ${failed} 条` };
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
      // 处理Excel日期序列号
      if (candidateData.graduationDate) {
        candidateData.graduationDate = convertExcelDate(candidateData.graduationDate);
      }
      candidate = this.candidateRepository.create(candidateData) as unknown as Candidate;
      candidate = await this.candidateRepository.save(candidate);
    }

    // 按姓名+电话同时匹配检查重复
    const existingCP = await this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .where('cp.positionId = :positionId', { positionId })
      .andWhere('candidate.name = :name', { name: candidate.name })
      .andWhere('candidate.contactPhone = :phone', { phone: candidate.contactPhone || '' })
      .getOne();

    if (existingCP) {
      // 同一推荐人：覆盖更新
      if (existingCP.recommenderId === userId) {
        // 更新候选人信息
        if (candidateData.resumeUrl) {
          existingCP.resumeUrl = candidateData.resumeUrl;
          candidate.resumeUrl = candidateData.resumeUrl;
          await this.candidateRepository.save(candidate);
        }
        if (candidateData.recommender) existingCP.recommender = candidateData.recommender;
        if (candidateData.recommendReason) existingCP.recommendReason = candidateData.recommendReason;
        existingCP.recommendedAt = new Date();
        existingCP.pushDate = new Date();
        const result = await this.candidatePositionRepository.save(existingCP);
        await this.logService.log(userId, 'update_candidate', 'position', positionId, {
          candidateId: candidate.id,
          candidateName: candidate.name,
          action: '覆盖更新',
        });
        this.socketGateway.broadcastToAllUsers('candidate.updated', { positionId, candidateId: candidate.id, candidateName: candidate.name });
        return result;
      }
      // 不同推荐人：报错
      throw new ConflictException(
        '该候选人已由其他用户推荐，不可重复推荐',
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
      resumeUrl: candidateData.resumeUrl || candidate.resumeUrl || null,
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

    // 自动将推荐人加入项目讨论组
    try {
      const group = await this.discussionService.findByProject(position.projectId);
      if (group) {
        await this.discussionService.addMember(group.id, userId);
      }
    } catch (err) {
      console.error('[Position] 添加讨论组成员失败:', err?.message || err);
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

  async removeCandidate(cpId: number, userId: number) {
    const cp = await this.candidatePositionRepository.findOne({
      where: { id: cpId },
      relations: ['candidate', 'position'],
    });
    if (!cp) {
      throw new NotFoundException('候选人岗位关联不存在');
    }
    await this.candidatePositionRepository.remove(cp);
    await this.logService.log(userId, 'remove_candidate', 'position', cp.positionId, {
      candidateId: cp.candidateId,
      candidateName: cp.candidate?.name,
    });
    this.socketGateway.broadcastToAllUsers('candidate.removed', { cpId, positionId: cp.positionId, candidateId: cp.candidateId });
    return { message: '移除成功' };
  }

  async batchRemoveCandidates(cpIds: number[], userId: number) {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    for (const cpId of cpIds) {
      try {
        await this.removeCandidate(cpId, userId);
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`ID ${cpId}: ${err.message || '未知错误'}`);
      }
    }
    return results;
  }

  // ========== 简历库相关方法 ==========

  // 获取岗位简历库列表
  async getResumeLibrary(positionId: number) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    const candidatePositions = await this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .where('cp.positionId = :positionId', { positionId })
      .orderBy('cp.recommendedAt', 'DESC')
      .getMany();

    return candidatePositions.map((cp) => ({
      cpId: cp.id,
      candidateId: cp.candidateId,
      name: cp.candidate?.name || '未知',
      contactPhone: cp.candidate?.contactPhone || '',
      supplier: cp.candidate?.supplier || '',
      status: cp.status,
      resumeUrl: cp.resumeUrl || cp.candidate?.resumeUrl || null,
      recommenderId: cp.recommenderId,
      recommender: cp.recommender || '',
      recommendedAt: cp.recommendedAt,
    }));
  }

  // 上传简历文件并提取文本
  async uploadResumeFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择文件');
    }

    const url = `/uploads/resumes/${file.filename}`;
    const originalName = Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8');

    // 提取文本
    let extractedText = '';
    try {
      const filePath = path.join(__dirname, '..', '..', '..', url.replace(/^\//, ''));
      const ext = file.originalname.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text || '';
      } else if (ext === 'docx' || ext === 'doc') {
        // Word文件暂无法直接提取文本
        extractedText = '';
      }
    } catch (err) {
      console.error('[Position] 提取简历文本失败:', err?.message || err);
    }

    return { url, fileName: originalName, extractedText };
  }

  // 智能上传简历：AI解析 + 匹配/创建候选人
  async smartUploadResume(positionId: number, fileUrl: string, fileName: string, extractedText: string, userId: number) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    // 如果没有提取到文本，尝试从文件重新提取
    if (!extractedText) {
      try {
        const filePath = path.join(__dirname, '..', '..', '..', fileUrl.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          const ext = fileUrl.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text || '';
          }
        }
      } catch (err) {
        console.error('[Position] 重新提取简历文本失败:', err?.message || err);
      }
    }

    // 使用AI解析简历文本
    let parsedInfo: any = {};
    if (extractedText) {
      try {
        parsedInfo = await this.aiService.parseResume(extractedText, userId);
      } catch (err) {
        console.error('[Position] AI解析简历失败:', err?.message || err);
      }
    }

    const candidateName = parsedInfo.name || fileName.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ').trim();
    const candidatePhone = parsedInfo.phone || '';

    if (!candidateName) {
      throw new BadRequestException('无法从简历中提取候选人姓名');
    }

    // 在该岗位下查找同名同电话的候选人
    const existingCP = await this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .where('cp.positionId = :positionId', { positionId })
      .andWhere('candidate.name = :name', { name: candidateName })
      .andWhere('candidate.contactPhone = :phone', { phone: candidatePhone || '' })
      .getOne();

    if (existingCP) {
      // 同一推荐人：覆盖更新简历
      if (existingCP.recommenderId === userId) {
        existingCP.resumeUrl = fileUrl;
        existingCP.candidate.resumeUrl = fileUrl;
        existingCP.candidate.resumeText = extractedText ? extractedText.substring(0, 30000) : existingCP.candidate.resumeText;
        // 更新候选人信息
        if (candidatePhone) existingCP.candidate.contactPhone = candidatePhone;
        if (parsedInfo.email) existingCP.candidate.contactEmail = parsedInfo.email;
        if (parsedInfo.education) existingCP.candidate.education = parsedInfo.education;
        if (parsedInfo.yearsOfExperience) existingCP.candidate.domainYears = Number(parsedInfo.yearsOfExperience) || existingCP.candidate.domainYears;
        await this.candidateRepository.save(existingCP.candidate);
        existingCP.recommendedAt = new Date();
        const result = await this.candidatePositionRepository.save(existingCP);
        return {
          action: 'updated',
          candidateId: existingCP.candidateId,
          cpId: existingCP.id,
          name: existingCP.candidate.name,
          phone: existingCP.candidate.contactPhone,
          supplier: existingCP.candidate.supplier,
          status: existingCP.status,
          resumeUrl: fileUrl,
          parsedInfo,
        };
      }
      // 不同推荐人
      throw new ConflictException('该候选人已由其他用户上传');
    }

    // 未找到匹配候选人，创建新候选人
    const candidate = this.candidateRepository.create({
      name: candidateName,
      contactPhone: candidatePhone || '',
      contactEmail: parsedInfo.email || '',
      education: parsedInfo.education || '未提供',
      domainYears: parsedInfo.yearsOfExperience ? Number(parsedInfo.yearsOfExperience) : null,
      supplier: parsedInfo.currentCompany || '未提供',
      resumeUrl: fileUrl,
      resumeText: extractedText ? extractedText.substring(0, 30000) : null,
      gender: '未提供',
      idType: '身份证',
      educationType: '统招',
      workStatus: '未提供',
      expectedSalary: '未提供',
    });
    const savedCandidate = await this.candidateRepository.save(candidate);

    const positionWithImpl = await this.positionRepository.findOne({
      where: { id: positionId },
    });

    const cp = this.candidatePositionRepository.create({
      candidateId: savedCandidate.id,
      positionId,
      status: 'pending_screen',
      recommendedAt: new Date(),
      pushDate: new Date(),
      recommender: '',
      recommenderId: userId,
      recommendReason: '简历库上传',
      implementation: positionWithImpl?.positionImplementation || '',
      resumeUrl: fileUrl,
    });
    const savedCp = await this.candidatePositionRepository.save(cp);

    await this.logService.log(userId, 'smart_upload_resume', 'position', positionId, {
      candidateId: savedCandidate.id,
      candidateName: savedCandidate.name,
      resumeUrl: fileUrl,
    });
    this.socketGateway.broadcastToAllUsers('candidate.added', { positionId, candidateId: savedCandidate.id, candidateName: savedCandidate.name });

    // 通知岗位创建者
    if (position.creatorId && position.creatorId !== userId) {
      this.noticeService.createSystemNotice(
        '新简历上传',
        `有新简历上传到您的岗位「${position.positionDuty}」：候选人「${savedCandidate.name}」`,
        position.creatorId,
      ).catch(() => {});
    }

    // 自动将上传者加入项目讨论组
    try {
      const group = await this.discussionService.findByProject(position.projectId);
      if (group) {
        await this.discussionService.addMember(group.id, userId);
      }
    } catch (err) {
      console.error('[Position] 添加讨论组成员失败:', err?.message || err);
    }

    return {
      action: 'created',
      candidateId: savedCandidate.id,
      cpId: savedCp.id,
      name: savedCandidate.name,
      phone: savedCandidate.contactPhone,
      supplier: savedCandidate.supplier,
      status: savedCp.status,
      resumeUrl: fileUrl,
      parsedInfo,
    };
  }

  // 批量导出简历为ZIP
  async exportResumes(positionId: number, candidateIds: number[], res: any) {
    const position = await this.positionRepository.findOne({
      where: { id: positionId },
    });
    if (!position) {
      throw new NotFoundException('岗位不存在');
    }

    // 查询候选人及其简历
    const cps = await this.candidatePositionRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.candidate', 'candidate')
      .where('cp.positionId = :positionId', { positionId })
      .andWhere('cp.candidateId IN (:...candidateIds)', { candidateIds })
      .getMany();

    if (cps.length === 0) {
      throw new NotFoundException('没有找到有简历的候选人');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=resumes_${position.positionDuty}_${Date.now()}.zip`);

    const archive = (archiver as any)('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
    let addedCount = 0;

    for (const cp of cps) {
      const resumeUrl = cp.resumeUrl || cp.candidate?.resumeUrl;
      if (!resumeUrl) continue;

      const filePath = path.join(uploadsDir, resumeUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        const ext = filePath.split('.').pop();
        const fileName = `${cp.candidate?.name || '未知'}_${cp.candidateId}.${ext}`;
        archive.file(filePath, { name: fileName });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      throw new NotFoundException('简历文件不存在');
    }

    archive.finalize();
  }

  async getDashboardStats(projectId?: number) {
    // 基础计数
    const projectQb = this.projectRepository.createQueryBuilder('project');
    if (projectId) {
      projectQb.where('project.id = :projectId', { projectId });
    }
    const totalProjects = await projectQb.getCount();

    const positionQb = this.positionRepository.createQueryBuilder('position');
    if (projectId) {
      positionQb.where('position.projectId = :projectId', { projectId });
    }
    const totalPositions = await positionQb.getCount();

    const openPositionQb = this.positionRepository.createQueryBuilder('position');
    if (projectId) {
      openPositionQb.where('position.projectId = :projectId', { projectId });
    }
    openPositionQb.andWhere('position.status IN (:...statuses)', { statuses: ['open', 'partial'] });
    const openPositions = await openPositionQb.getCount();

    // 候选人总数和面试数 - 基于 candidate_positions
    const cpQb = this.candidatePositionRepository.createQueryBuilder('cp');
    if (projectId) {
      cpQb.innerJoin('cp.position', 'position', 'position.projectId = :projectId', { projectId });
    }
    const totalCandidates = await cpQb.getCount();

    const interviewQb = this.candidatePositionRepository.createQueryBuilder('cp');
    if (projectId) {
      interviewQb.innerJoin('cp.position', 'position', 'position.projectId = :projectId', { projectId });
    }
    interviewQb.andWhere('cp.status IN (:...statuses)', {
      statuses: ['pending_interview', 'interview_passed', 'interview_rejected'],
    });
    const totalInterviews = await interviewQb.getCount();

    // 筛选通过率: (screen_passed + pending_interview + interview_passed + interview_rejected + pending_onboard + onboarded) / total * 100
    const screenPassQb = this.candidatePositionRepository.createQueryBuilder('cp');
    if (projectId) {
      screenPassQb.innerJoin('cp.position', 'position', 'position.projectId = :projectId', { projectId });
    }
    screenPassQb.andWhere('cp.status IN (:...statuses)', {
      statuses: ['screen_passed', 'pending_interview', 'interview_passed', 'interview_rejected', 'pending_onboard', 'onboarded'],
    });
    const screenPassCount = await screenPassQb.getCount();
    const screeningPassRate = totalCandidates > 0 ? Math.round((screenPassCount / totalCandidates) * 1000) / 10 : 0;

    // 面试通过率: (interview_passed + pending_onboard + onboarded) / (interview_passed + interview_rejected + pending_onboard + onboarded) * 100
    const interviewPassQb = this.candidatePositionRepository.createQueryBuilder('cp');
    if (projectId) {
      interviewPassQb.innerJoin('cp.position', 'position', 'position.projectId = :projectId', { projectId });
    }
    interviewPassQb.andWhere('cp.status IN (:...statuses)', {
      statuses: ['interview_passed', 'pending_onboard', 'onboarded'],
    });
    const interviewPassCount = await interviewPassQb.getCount();

    const interviewTotalQb = this.candidatePositionRepository.createQueryBuilder('cp');
    if (projectId) {
      interviewTotalQb.innerJoin('cp.position', 'position', 'position.projectId = :projectId', { projectId });
    }
    interviewTotalQb.andWhere('cp.status IN (:...statuses)', {
      statuses: ['interview_passed', 'interview_rejected', 'pending_onboard', 'onboarded'],
    });
    const interviewTotalCount = await interviewTotalQb.getCount();
    const interviewPassRate = interviewTotalCount > 0 ? Math.round((interviewPassCount / interviewTotalCount) * 1000) / 10 : 0;

    // 最近活动日志
    const activityQb = this.candidatePositionRepository
      .createQueryBuilder('cp')
      .leftJoinAndSelect('cp.candidate', 'candidate')
      .leftJoinAndSelect('cp.position', 'position')
      .leftJoinAndSelect('position.project', 'project')
      .select([
        'cp.id',
        'cp.status',
        'cp.recommendedAt',
        'cp.recommender',
        'cp.recommenderId',
        'cp.implementation',
        'candidate.id',
        'candidate.name',
        'position.id',
        'position.positionDuty',
        'position.positionImplementation',
        'project.id',
        'project.name',
      ])
      .orderBy('cp.recommendedAt', 'DESC')
      .limit(20);

    if (projectId) {
      activityQb.andWhere('position.projectId = :projectId', { projectId });
    }

    const recentActivities = await activityQb.getMany();

    // 获取上传者信息
    const recommenderIds = [...new Set(recentActivities.map(a => a.recommenderId).filter(Boolean))];
    let userMap = new Map<number, string>();
    if (recommenderIds.length > 0) {
      const users = await this.userRepository.findBy({ id: In(recommenderIds) });
      users.forEach(u => userMap.set(u.id, u.nickname || u.name || u.username));
    }

    const activityLog = recentActivities.map(cp => ({
      id: cp.id,
      time: cp.recommendedAt,
      recommenderName: cp.recommender || (cp.recommenderId ? userMap.get(cp.recommenderId) : null) || '未知',
      projectName: (cp.position as any)?.project?.name || '未知项目',
      positionDuty: (cp.position as any)?.positionDuty || '未知岗位',
      positionImplementation: cp.implementation || (cp.position as any)?.positionImplementation || '',
      candidateName: cp.candidate?.name || '未知',
      status: cp.status,
    }));

    return {
      totalProjects,
      totalPositions,
      openPositions,
      totalCandidates,
      totalInterviews,
      screeningPassRate,
      interviewPassRate,
      recentActivities: activityLog,
    };
  }
}