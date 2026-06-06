import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    @Body() body: Partial<{ name: string; avatar: string; password: string }>,
  ) {
    return this.userService.update(id, body);
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
