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
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ProjectService } from '../project/project.service';
import { PositionService } from '../position/position.service';
import { CandidateService } from '../candidate/candidate.service';
import { InterviewService } from '../interview/interview.service';
import { AiService } from '../ai/ai.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
