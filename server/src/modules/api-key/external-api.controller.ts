import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Inject,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ProjectService } from '../project/project.service';
import { PositionService } from '../position/position.service';
import { CandidateService } from '../candidate/candidate.service';
import { InterviewService } from '../interview/interview.service';
import { AiService } from '../ai/ai.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Position } from '../../entities/position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Interview } from '../../entities/interview.entity';

@Controller('external')
@UseGuards(ApiKeyGuard)
export class ExternalApiController {
  constructor(
    private projectService: ProjectService,
    private positionService: PositionService,
    private candidateService: CandidateService,
    private interviewService: InterviewService,
    private aiService: AiService,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
    @InjectRepository(Interview) private interviewRepo: Repository<Interview>,
  ) {}

  // ===== Projects =====
  @Get('projects')
  async listProjects(@Request() req: any, @Query() query: any) {
    return this.projectService.findAll(query);
  }

  @Get('projects/:id')
  async getProject(@Param('id') id: number) {
    return this.projectService.findOne(id);
  }

  @Post('projects')
  async createProject(@Body() body: any, @Request() req: any) {
    return this.projectService.create(body, req.user.id);
  }

  @Put('projects/:id')
  async updateProject(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    return this.projectService.update(id, body, req.user.id);
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') id: number, @Request() req: any) {
    return this.projectService.remove(id, req.user.id);
  }

  // ===== Positions =====
  @Get('positions')
  async listPositions(@Query() query: any) {
    return this.positionService.findAll(query);
  }

  @Get('positions/:id')
  async getPosition(@Param('id') id: number) {
    return this.positionService.findOne(id);
  }

  @Post('positions')
  async createPosition(@Body() body: any, @Request() req: any) {
    return this.positionService.create(body, req.user.id);
  }

  @Post('positions/batch-import')
  async batchImportPositions(@Body() body: { items: any[]; projectId: number }, @Request() req: any) {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < body.items.length; i++) {
      try {
        const item = { ...body.items[i], projectId: body.projectId };
        await this.positionService.create(item, req.user.id);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`第${i + 1}条: ${err?.message || '未知错误'}`);
      }
    }
    return { success, failed, errors };
  }

  @Put('positions/:id')
  async updatePosition(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    return this.positionService.update(id, body, req.user.id);
  }

  @Delete('positions/:id')
  async deletePosition(@Param('id') id: number, @Request() req: any) {
    return this.positionService.remove(id, req.user.id);
  }

  // ===== Position Candidates =====
  @Get('positions/:id/candidates')
  async getPositionCandidates(@Param('id') id: number) {
    return this.positionService.getCandidates(id);
  }

  @Post('positions/:id/candidates')
  async addCandidateToPosition(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    return this.positionService.addCandidate(id, body, req.user.id);
  }

  @Post('positions/:id/candidates/batch-import')
  async batchImportCandidates(@Param('id') id: number, @Body() body: { items: any[] }, @Request() req: any) {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < body.items.length; i++) {
      try {
        await this.positionService.addCandidate(id, body.items[i], req.user.id);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`第${i + 1}条(${body.items[i].name || '未知'}): ${err?.message || '未知错误'}`);
      }
    }
    return { success, failed, errors };
  }

  @Delete('positions/:positionId/candidates/:cpId')
  async removeCandidateFromPosition(
    @Param('positionId') positionId: number,
    @Param('cpId') cpId: number,
    @Request() req: any,
  ) {
    return this.positionService.removeCandidate(cpId, req.user.id);
  }

  @Post('positions/:id/candidates/batch-remove')
  async batchRemoveCandidates(
    @Param('id') id: number,
    @Body() body: { cpIds: number[] },
    @Request() req: any,
  ) {
    return this.positionService.batchRemoveCandidates(body.cpIds, req.user.id);
  }

  @Put('candidate-position/:cpId/status')
  async updateCandidateStatus(
    @Param('cpId') cpId: number,
    @Body() body: { status: string },
    @Request() req: any,
  ) {
    return this.candidateService.updateCandidatePositionStatus(cpId, body.status, req.user.id);
  }

  // ===== 简历文件上传（multipart/form-data） =====

  // 一步完成：上传简历文件 + AI解析 + 匹配/创建候选人
  @Post('positions/:id/resume-upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = (file.originalname || '').split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async smartUploadResumeFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const { url, fileName, extractedText } = await this.positionService.uploadResumeFile(file);
    return this.positionService.smartUploadResume(id, url, fileName, extractedText, req.user.id);
  }

  // 兼容别名：外部AI常见猜测路径 /positions/:id/candidates/upload
  @Post('positions/:id/candidates/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = (file.originalname || '').split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadResumePositionAlias(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const { url, fileName, extractedText } = await this.positionService.uploadResumeFile(file);
    return this.positionService.smartUploadResume(id, url, fileName, extractedText, req.user.id);
  }

  // 兼容路径：/upload-resume、/candidates/upload-resume、/candidates/upload、/resumes/upload、/resume、/upload
  // positionId 通过 query 参数（?positionId=2）或 multipart 表单字段 positionId 传入
  @Post([
    'upload-resume',
    'candidates/upload-resume',
    'candidates/upload',
    'candidates/upload-file',
    'candidates/resume',
    'resumes/upload',
    'resumes',
    'resume',
    'upload',
    'file',
  ])
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = (file.originalname || '').split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadResumeFlexible(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
    @Query('positionId') queryPositionId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('缺少文件。请用 multipart/form-data 上传，文件字段名为 file。正确用法：POST /api/external/positions/{岗位ID}/resume-upload');
    }
    // positionId 优先级：query 参数 > multipart 表单字段
    const rawId = queryPositionId || req.body?.positionId || req.body?.position_id;
    const positionId = Number(rawId);
    if (!rawId || isNaN(positionId)) {
      throw new BadRequestException(
        '缺少岗位ID。两种方式：1) POST /api/external/positions/{岗位ID}/resume-upload；2) 本端点加 query 参数 ?positionId=岗位ID 或表单字段 positionId。可用 GET /api/external/positions 查询岗位列表获取ID',
      );
    }
    const { url, fileName, extractedText } = await this.positionService.uploadResumeFile(file);
    return this.positionService.smartUploadResume(positionId, url, fileName, extractedText, req.user.id);
  }

  // 批量上传简历文件（一次最多20个），逐个AI解析并匹配/创建候选人
  @Post('positions/:id/resume-upload-batch')
  @UseInterceptors(FilesInterceptor('files', 20, {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = (file.originalname || '').split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async smartUploadResumeFiles(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    const results: any[] = [];
    let success = 0;
    let failed = 0;
    for (const file of files || []) {
      try {
        const { url, fileName, extractedText } = await this.positionService.uploadResumeFile(file);
        const result = await this.positionService.smartUploadResume(id, url, fileName, extractedText, req.user.id);
        results.push({ file: Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8'), success: true, ...result });
        success++;
      } catch (err: any) {
        results.push({ file: Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8'), success: false, error: err?.message || '上传失败' });
        failed++;
      }
    }
    return { success, failed, results };
  }

  // 仅上传简历文件（不创建候选人），返回 url/fileName/extractedText
  @Post('positions/:id/resume-library/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = (file.originalname || '').split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadResumeToLibrary(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.positionService.uploadResumeFile(file);
  }

  // 两步上传第二步：用已上传文件的 url 创建候选人（AI解析 + 匹配/创建）
  @Post('positions/:id/resume-library/smart-upload')
  async smartUploadResume(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fileUrl: string; fileName: string; extractedText?: string },
    @Request() req: any,
  ) {
    return this.positionService.smartUploadResume(
      id,
      body.fileUrl,
      body.fileName,
      body.extractedText || '',
      req.user.id,
    );
  }

  // ===== Candidates =====
  @Get('candidates')
  async listCandidates(@Query() query: any) {
    return this.candidateService.findAll(query);
  }

  @Get('candidates/:id')
  async getCandidate(@Param('id') id: number) {
    return this.candidateService.findOne(id);
  }

  @Post('candidates')
  async createCandidate(@Body() body: any, @Request() req: any) {
    return this.candidateService.create(body, req.user.id);
  }

  @Put('candidates/:id')
  async updateCandidate(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    return this.candidateService.update(id, body, req.user.id);
  }

  @Delete('candidates/:id')
  async deleteCandidate(@Param('id') id: number, @Request() req: any) {
    return this.candidateService.remove(id, req.user.id);
  }

  // ===== AI Agent (full capability) =====
  @Post('ai/agent-chat')
  async aiAgentChat(@Body() body: { message?: string; messages?: { role: string; content: string }[] }, @Request() req: any) {
    let messages: { role: string; content: string }[];
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
    } else if (body.message) {
      messages = [{ role: 'user', content: body.message }];
    } else {
      messages = [];
    }
    return this.aiService.agentChat(messages, req.user.id);
  }

  @Post('ai/agent-chat-with-file')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async aiAgentChatWithFile(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { messages?: string },
    @Request() req: any,
  ) {
    let messages: { role: string; content: string }[] = [];
    try {
      messages = body.messages ? JSON.parse(body.messages) : [];
    } catch { /* ignore */ }

    if (files && files.length > 0) {
      const fileInfos: string[] = [];
      for (const file of files) {
        let fileContent = '';
        const fileName = Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8');
        if (file.buffer) {
          const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
          if (ext === 'xlsx' || ext === 'xls') {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001 });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            fileContent = jsonData.map(row => row.join(',')).join('\n');
          } else {
            fileContent = file.buffer.toString('utf-8');
          }
        }
        fileInfos.push(`--- 文件"${fileName}" ---\n${fileContent.substring(0, 30000)}`);
      }
      const fileInfoMsg = `用户上传了${files.length}个文件：\n${fileInfos.join('\n\n')}\n\n请根据文件内容和用户的要求执行操作。`;
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += '\n\n' + fileInfoMsg;
      } else {
        messages.push({ role: 'user', content: fileInfoMsg });
      }
    }

    return this.aiService.agentChat(messages, req.user.id);
  }

  @Post('ai/chat')
  async aiChat(@Body() body: { message: string }, @Request() req: any) {
    return this.aiService.chat([{ role: 'user', content: body.message }], req.user.id);
  }

  @Post('ai/match')
  async aiMatch(@Body() body: { candidateId: number; positionId: number }, @Request() req: any) {
    return this.aiService.matchCandidate({ id: body.candidateId } as any, { id: body.positionId } as any, req.user.id);
  }

  @Post('ai/analyze-risk')
  async aiAnalyzeRisk(@Body() body: any, @Request() req: any) {
    return this.aiService.analyzeRisk(body, req.user.id);
  }

  @Post('ai/generate-report')
  async aiGenerateReport(@Body() body: { type: string; params: any }, @Request() req: any) {
    return this.aiService.generateReport(body.type, body.params, req.user.id);
  }

  // ===== Interviews =====
  @Get('interviews')
  async listInterviews(@Query() query: any) {
    return this.interviewService.findAll(query);
  }

  @Post('interviews')
  async createInterview(@Body() body: any, @Request() req: any) {
    return this.interviewService.create(body, req.user.id);
  }

  // ===== Dashboard =====
  @Get('dashboard/stats')
  async getDashboardStats() {
    const [projectCount, positionCount, candidateCount, interviewCount] = await Promise.all([
      this.projectRepo.count(),
      this.positionRepo.count(),
      this.candidateRepo.count(),
      this.interviewRepo.count(),
    ]);
    return { projectCount, positionCount, candidateCount, interviewCount };
  }
}
