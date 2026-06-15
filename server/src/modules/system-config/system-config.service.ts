import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private configRepository: Repository<SystemConfig>,
  ) {}

  async get(key: string): Promise<string | null> {
    const config = await this.configRepository.findOne({ where: { key } });
    return config?.value ?? null;
  }

  async set(key: string, value: string, description?: string): Promise<SystemConfig> {
    let config = await this.configRepository.findOne({ where: { key } });
    if (config) {
      config.value = value;
      if (description !== undefined) config.description = description;
    } else {
      config = this.configRepository.create({ key, value, description });
    }
    return this.configRepository.save(config);
  }

  async delete(key: string): Promise<void> {
    await this.configRepository.delete({ key });
  }

  async getAll(): Promise<SystemConfig[]> {
    return this.configRepository.find({ order: { key: 'ASC' } });
  }

  async getLlmConfig(): Promise<{ baseUrl: string; apiKey: string; model: string }> {
    const [baseUrl, apiKey, model] = await Promise.all([
      this.get('llm_base_url'),
      this.get('llm_api_key'),
      this.get('llm_model'),
    ]);
    return {
      baseUrl: baseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      apiKey: apiKey || process.env.LLM_API_KEY || '',
      model: model || process.env.LLM_MODEL || 'gpt-3.5-turbo',
    };
  }

  async setLlmConfig(data: { baseUrl?: string; apiKey?: string; model?: string }) {
    const results: SystemConfig[] = [];
    if (data.baseUrl !== undefined) {
      results.push(await this.set('llm_base_url', data.baseUrl, '系统默认LLM API地址'));
    }
    if (data.apiKey !== undefined) {
      results.push(await this.set('llm_api_key', data.apiKey, '系统默认LLM API密钥'));
    }
    if (data.model !== undefined) {
      results.push(await this.set('llm_model', data.model, '系统默认LLM模型名称'));
    }
    return results;
  }
}
