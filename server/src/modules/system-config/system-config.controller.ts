import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SystemConfigService } from './system-config.service';

@Controller('system-config')
@UseGuards(AuthGuard('jwt'))
export class SystemConfigController {
  constructor(private configService: SystemConfigService) {}

  @Get()
  async getAll() {
    return this.configService.getAll();
  }

  @Get('llm')
  async getLlmConfig() {
    const config = await this.configService.getLlmConfig();
    // 隐藏API Key中间部分
    const maskedApiKey = config.apiKey
      ? config.apiKey.substring(0, 8) + '****' + config.apiKey.substring(config.apiKey.length - 4)
      : '';
    return { ...config, apiKey: maskedApiKey, apiKeyConfigured: !!config.apiKey };
  }

  @Put('llm')
  async setLlmConfig(
    @Body() body: { baseUrl?: string; apiKey?: string; model?: string },
  ) {
    // 如果apiKey是掩码格式，不更新
    const data = { ...body };
    if (data.apiKey && data.apiKey.includes('****')) {
      delete data.apiKey;
    }
    await this.configService.setLlmConfig(data);
    return { message: 'AI配置已更新' };
  }
}
