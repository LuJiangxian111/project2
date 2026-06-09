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
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ProjectService } from '../project/project.service';
import { PositionService } from '../position/position.service';
import { CandidateService } from '../candidate/candidate.service';
import { InterviewService } from '../interview/interview.service';
import { AiService } from '../ai/ai.service';

@Controller('external')
@UseGuards(ApiKeyGuard)
export class ExternalApiController {
  constructor(
    private projectService: ProjectService,
    private positionService: PositionService,
    private candidateService: CandidateService,
    private interviewService: InterviewService,
    private aiService: AiService,
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

  @Put('positions/:id')
  async updatePosition(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    return this.positionService.update(id, body, req.user.id);
  }

  @Delete('positions/:id')
  async deletePosition(@Param('id') id: number, @Request() req: any) {
    return this.positionService.remove(id, req.user.id);
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

  // ===== AI =====
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
}
