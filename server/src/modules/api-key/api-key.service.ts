import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from '../../entities/api-key.entity';
import { LogService } from '../log/log.service';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    private logService: LogService,
  ) {}

  async create(userId: number, name: string): Promise<{ apiKey: string; keyPrefix: string }> {
    // Generate a random API key: aps_ + 32 random hex chars
    const rawKey = `aps_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      userId,
      keyHash,
      keyPrefix,
      name,
      active: true,
    });

    await this.apiKeyRepository.save(apiKey);

    await this.logService.log(userId, 'create', 'api_key', apiKey.id, { name, keyPrefix });

    // Return the raw key only once
    return { apiKey: rawKey, keyPrefix };
  }

  async list(userId: number): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(userId: number, id: number): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }
    if (apiKey.userId !== userId) {
      throw new ForbiddenException('无权操作此 API Key');
    }
    apiKey.active = false;
    await this.apiKeyRepository.save(apiKey);

    await this.logService.log(userId, 'revoke', 'api_key', id, { keyPrefix: apiKey.keyPrefix });
  }

  async delete(userId: number, id: number): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }
    if (apiKey.userId !== userId) {
      throw new ForbiddenException('无权操作此 API Key');
    }
    await this.apiKeyRepository.remove(apiKey);

    await this.logService.log(userId, 'delete', 'api_key', id, { keyPrefix: apiKey.keyPrefix });
  }
}
