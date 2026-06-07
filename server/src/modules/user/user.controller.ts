import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as path from 'path';
import * as fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.userService.findAll({ role, keyword });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; nickname: string; gender: string; phone: string; email: string; avatar: string; password: string }>,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'admin') {
      throw new BadRequestException('无权修改他人信息');
    }
    return this.userService.update(id, body);
  }

  @Put(':id/password')
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { oldPassword: string; newPassword: string },
    @CurrentUser() user: any,
  ) {
    if (user.id !== id) {
      throw new BadRequestException('只能修改自己的密码');
    }
    return this.userService.changePassword(id, body.oldPassword, body.newPassword);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (user.id !== id) {
      throw new BadRequestException('只能上传自己的头像');
    }
    if (!file) {
      throw new BadRequestException('请选择文件');
    }
    // 确保 uploads/avatars 目录存在
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const ext = path.extname(file.originalname) || '.png';
    const filename = `avatar_${id}_${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, file.buffer);
    const avatarUrl = `/uploads/avatars/${filename}`;
    await this.userService.update(id, { avatar: avatarUrl } as any);
    return { url: avatarUrl };
  }

  @Put(':id/llm-config')
  async updateLlmConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { llmApiKey?: string; llmBaseUrl?: string; llmModel?: string },
    @CurrentUser() user: any,
  ) {
    if (user.id !== id && user.role !== 'admin') {
      throw new Error('无权修改他人的AI配置');
    }
    return this.userService.updateLlmConfig(id, body);
  }
}
