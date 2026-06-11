import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import * as XLSX from 'xlsx';

// 提取文件文本内容
function extractFileContent(file: Express.Multer.File): string {
  if (!file) return '';
  if (file.buffer) {
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_csv(sheet);
    }
    return file.buffer.toString('utf-8');
  }
  return file.originalname || '';
}

// 解析上传文件为结构化数据
function parseFileToRows(file: Express.Multer.File): { headers: string[]; rows: Record<string, string>[]; sampleText: string } {
  if (!file || !file.buffer) return { headers: [], rows: [], sampleText: '' };
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0]; // 取第一个工作表
    const sheet = workbook.Sheets[sheetName];
    const jsonData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (jsonData.length < 2) return { headers: [], rows: [], sampleText: '' };

    const headers = jsonData[0].map((h) => String(h).trim());
    console.log(`[AI] parseFile headers sample:`, headers.slice(0, 5));
    console.log(`[AI] parseFile row1 sample:`, jsonData[1]?.slice(0, 5));
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = String(jsonData[i][idx] ?? '').trim();
      });
      // 跳过全空行
      if (Object.values(obj).some((v) => v)) {
        rows.push(obj);
      }
    }

    // 生成样本文本给 AI（表头 + 前5行）
    const sampleRows = rows.slice(0, 5);
    const sampleLines = [headers.join(','), ...sampleRows.map((r) => headers.map((h) => r[h]).join(','))];
    const sampleText = sampleLines.join('\n') + (rows.length > 5 ? `\n... (共${rows.length}行数据)` : '');

    return { headers, rows, sampleText };
  }

  // 其他文本文件
  const text = file.buffer.toString('utf-8');
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], sampleText: text.substring(0, 3000) };

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    if (Object.values(obj).some((v) => v)) rows.push(obj);
  }

  const sampleRows = rows.slice(0, 5);
  const sampleLines = [headers.join(','), ...sampleRows.map((r) => headers.map((h) => r[h]).join(','))];
  const sampleText = sampleLines.join('\n') + (rows.length > 5 ? `\n... (共${rows.length}行数据)` : '');

  return { headers, rows, sampleText };
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  async chat(
    @Body() body: { message?: string; messages?: { role: string; content: string }[] },
    @CurrentUser() user: any,
  ) {
    // 兼容前端发送 message 字符串或 messages 数组
    let messages: { role: string; content: string }[];
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
    } else if (body.message) {
      messages = [{ role: 'user', content: body.message }];
    } else {
      messages = [];
    }
    return this.aiService.chat(messages, user.id);
  }

  @Post('agent-chat')
  async agentChat(
    @Body() body: { message?: string; messages?: { role: string; content: string }[] },
    @CurrentUser() user: any,
  ) {
    let messages: { role: string; content: string }[];
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
    } else if (body.message) {
      messages = [{ role: 'user', content: body.message }];
    } else {
      messages = [];
    }
    return this.aiService.agentChat(messages, user.id);
  }

  @Post('analyze-file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async analyzeFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    try {
      if (!file || !file.buffer) {
        return { type: 'unknown', items: [], rawContent: '', summary: '未接收到文件，请重新上传' };
      }
      const { headers, rows, sampleText } = parseFileToRows(file);
      const fileName = Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8');
      const instruction = body.instruction || '';

      if (!rows.length) {
        return { type: 'unknown', items: [], rawContent: '', summary: '文件内容为空，请确认文件格式' };
      }

      console.log(`[AI] analyzeFile: fileName=${fileName}, rows=${rows.length}, headers=${headers.join(',')}`);

      // 只发送样本给 AI 做字段映射
      const aiResult: any = await this.aiService.analyzeFileForImport(sampleText, fileName, instruction, user.id);

      // AI 返回了映射关系，用全量数据在后端本地映射
      if ((aiResult.type === 'position' || aiResult.type === 'candidate') && aiResult.fieldMapping) {
        const mapping = aiResult.fieldMapping; // { 原始列名: 系统标准字段名 }
        const items = rows.map((row) => {
          const mapped: Record<string, string> = {};
          for (const [srcField, targetField] of Object.entries(mapping)) {
            if (row[srcField] !== undefined) {
              mapped[targetField as string] = row[srcField];
            }
          }
          return mapped;
        }).filter((item) => Object.values(item).some((v) => v));

        return {
          type: aiResult.type,
          items,
          unmappedFields: aiResult.unmappedFields,
          summary: aiResult.summary,
        };
      }

      // AI 没有返回 fieldMapping，回退
      return aiResult;
    } catch (err: any) {
      console.error('[AI] analyze-file error:', err?.message || err, err?.stack?.split('\n').slice(0, 3));
      return { type: 'unknown', items: [], rawContent: '', summary: `分析失败: ${err?.message || '未知错误'}` };
    }
  }

  @Post('chat-with-file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async chatWithFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { messages?: string },
    @CurrentUser() user: any,
  ) {
    let messages: { role: string; content: string }[] = [];
    try {
      messages = body.messages ? JSON.parse(body.messages) : [];
    } catch { /* ignore */ }

    const fileContent = extractFileContent(file);
    const fileName = file?.originalname || '未知文件';

    return this.aiService.chatWithFile(messages, fileContent, fileName, user.id);
  }

  @Post('agent-chat-with-file')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  async agentChatWithFile(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { messages?: string },
    @CurrentUser() user: any,
  ) {
    let messages: { role: string; content: string }[] = [];
    try {
      messages = body.messages ? JSON.parse(body.messages) : [];
    } catch { /* ignore */ }

    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'resumes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Parse all files content and save to disk
    const savedFiles: { fileName: string; savedUrl: string; size: number }[] = [];
    if (files && files.length > 0) {
      const fileInfos: string[] = [];
      for (const file of files) {
        let fileContent = '';
        const fileName = Buffer.from(file.originalname || '未知文件', 'latin1').toString('utf-8');
        const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || 'bin';

        // 保存文件到磁盘
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const savedFileName = `${uniqueSuffix}.${ext}`;
        const savedPath = path.join(uploadsDir, savedFileName);
        const savedUrl = `/uploads/resumes/${savedFileName}`;

        if (file.buffer) {
          fs.writeFileSync(savedPath, file.buffer);
          savedFiles.push({ fileName, savedUrl, size: file.buffer.length });

          if (ext === 'xlsx' || ext === 'xls') {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(file.buffer, { type: 'buffer', codepage: 65001 });
            // 读取所有工作表
            const allSheetsInfo: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const jsonData: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
              if (jsonData.length === 0) continue;
              const headers = Object.keys(jsonData[0]);
              allSheetsInfo.push(`工作表"${sheetName}" (${jsonData.length}行数据):\n表头: ${headers.join(' | ')}\n数据(JSON):\n${JSON.stringify(jsonData, null, 2)}`);
            }
            fileContent = allSheetsInfo.join('\n\n');
          } else if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
            fileContent = `[${ext.toUpperCase()}文件，文件名: ${fileName}，大小: ${(file.buffer.length / 1024).toFixed(1)}KB，已保存到: ${savedUrl}]`;
          } else {
            fileContent = file.buffer.toString('utf-8');
          }
        } else {
          savedFiles.push({ fileName, savedUrl: '', size: 0 });
        }
        fileInfos.push(`--- 文件"${fileName}" ---\n${fileContent.substring(0, 100000)}`);
      }

      const savedFilesInfo = savedFiles.map(f => `文件名: ${f.fileName}, 保存路径: ${f.savedUrl}`).join('\n');
      const fileInfoMsg = `用户上传了${files.length}个文件：\n${fileInfos.join('\n\n')}\n\n已保存的文件信息：\n${savedFilesInfo}\n\n请根据文件内容和用户的要求执行操作。如果需要为候选人上传简历，请使用upload_candidate_resume工具，resumeUrl字段使用上面提供的保存路径。`;
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages[messages.length - 1].content += '\n\n' + fileInfoMsg;
      } else {
        messages.push({ role: 'user', content: fileInfoMsg });
      }
    }

    return this.aiService.agentChat(messages, user.id, savedFiles);
  }

  @Post('parse-resume')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', '..', 'uploads'),
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
    const fileContent = extractFileContent(file);
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
        destination: join(__dirname, '..', '..', '..', 'uploads'),
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
    const fileContent = extractFileContent(file);
    const fileType = file.originalname.split('.').pop() || 'txt';
    return this.aiService.importFile(fileContent, fileType, user.id);
  }
}
