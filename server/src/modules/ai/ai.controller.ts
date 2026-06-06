import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  async chat(
    @Body() body: { messages: { role: string; content: string }[] },
    @CurrentUser() user: any,
  ) {
    return this.aiService.chat(body.messages, user.id);
  }

  @Post('parse-resume')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + '-' + file.originalname);
        },
      }),
    }),
  )
  async parseResume(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const fileContent = file.buffer
      ? file.buffer.toString('utf-8')
      : '';
    return this.aiService.parseResume(fileContent || file.originalname, user.id);
  }

  @Post('match')
  async match(
    @Body() body: { candidateId: number; positionId: number },
    @CurrentUser() user: any,
  ) {
    return this.aiService.matchCandidate(
      { id: body.candidateId } as any,
      { id: body.positionId } as any,
      user.id,
    );
  }

  @Post('generate-report')
  async generateReport(
    @Body() body: { type: string; params: any },
    @CurrentUser() user: any,
  ) {
    return this.aiService.generateReport(body.type, body.params, user.id);
  }

  @Post('analyze-risk')
  async analyzeRisk(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.aiService.analyzeRisk(body, user.id);
  }

  @Post('import-file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + '-' + file.originalname);
        },
      }),
    }),
  )
  async importFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const fileContent = file.buffer
      ? file.buffer.toString('utf-8')
      : '';
    const fileType = file.originalname.split('.').pop() || 'txt';
    return this.aiService.importFile(fileContent, fileType, user.id);
  }
}
