import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import * as archiver from 'archiver';
import * as fs from 'fs';
import { CandidateService } from './candidate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('candidates')
@UseGuards(JwtAuthGuard)
export class CandidateController {
  constructor(private candidateService: CandidateService) {}

  @Get()
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('source') source?: string,
  ) {
    return this.candidateService.findAll({ keyword, source });
  }

  @Get('grouped')
  async findAllGrouped(
    @Query('keyword') keyword?: string,
    @Query('projectId') projectId?: string,
    @Query('positionId') positionId?: string,
    @Query('status') status?: string,
  ) {
    return this.candidateService.findAllWithPositions({
      keyword,
      projectId: projectId ? Number(projectId) : undefined,
      positionId: positionId ? Number(positionId) : undefined,
      status,
    });
  }

  @Post('upload-resume')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', '..', 'uploads', 'resumes'),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop();
        cb(null, uniqueSuffix + '.' + ext);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { code: 1, message: '请选择文件' };
    const url = `/uploads/resumes/${file.filename}`;
    const originalName = Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8');
    return { code: 0, message: '上传成功', data: { url, fileName: originalName } };
  }

  @Get('export-resumes')
  async exportResumes(
    @Query('projectId') projectId?: string,
    @Query('positionId') positionId?: string,
    @Query('candidateIds') candidateIdsStr?: string,
    @Res() res?: Response,
  ) {
    // 支持按候选人ID列表筛选
    let candidateIds: number[] | undefined;
    if (candidateIdsStr) {
      candidateIds = candidateIdsStr.split(',').map(Number).filter(n => !isNaN(n));
    }

    // 查询有简历的候选人
    const candidates = await this.candidateService.findCandidatesWithResume(
      projectId ? Number(projectId) : undefined,
      positionId ? Number(positionId) : undefined,
      candidateIds,
    );

    if (candidates.length === 0) {
      res.status(404).json({ message: '没有找到有简历的候选人' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=resumes_${Date.now()}.zip`);

    const archive = (archiver as any)('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    const uploadsDir = join(__dirname, '..', '..', '..', 'uploads');
    let addedCount = 0;

    for (const candidate of candidates) {
      const resumeUrl = candidate.resumeUrl;
      if (!resumeUrl) continue;

      // resumeUrl 格式: /uploads/resumes/xxx.pdf
      const filePath = join(uploadsDir, resumeUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        const ext = filePath.split('.').pop();
        const fileName = `${candidate.name}_${candidate.id}.${ext}`;
        archive.file(filePath, { name: fileName });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      res.status(404).json({ message: '简历文件不存在' });
      return;
    }

    archive.finalize();
  }

  @Post()
  async create(
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.create(body, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.candidateService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.update(id, body, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.remove(id, user.id);
  }

  @Post(':id/match/:positionId')
  async matchWithPosition(
    @Param('id', ParseIntPipe) id: number,
    @Param('positionId', ParseIntPipe) positionId: number,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.matchWithPosition(id, positionId, user.id);
  }
}
