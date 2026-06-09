import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @Body() body: { name: string },
    @CurrentUser() user: any,
  ) {
    return this.apiKeyService.create(user.id, body.name);
  }

  @Get()
  async list(@CurrentUser() user: any) {
    return this.apiKeyService.list(user.id);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: number,
    @CurrentUser() user: any,
  ) {
    await this.apiKeyService.delete(user.id, id);
    return { message: 'API Key 已删除' };
  }

  @Post(':id/revoke')
  async revoke(
    @Param('id') id: number,
    @CurrentUser() user: any,
  ) {
    await this.apiKeyService.revoke(user.id, id);
    return { message: 'API Key 已停用' };
  }
}
