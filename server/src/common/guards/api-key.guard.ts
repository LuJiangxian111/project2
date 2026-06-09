import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../../entities/api-key.entity';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const apiKeyEntity = await this.apiKeyRepository.findOne({
      where: { keyHash, active: true },
      relations: ['user'],
    });

    if (!apiKeyEntity) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // Update last used time
    apiKeyEntity.lastUsedAt = new Date();
    await this.apiKeyRepository.save(apiKeyEntity);

    // Attach user info to request for downstream use
    request.user = {
      id: apiKeyEntity.user.id,
      username: apiKeyEntity.user.username,
      role: apiKeyEntity.user.role,
    };

    return true;
  }
}
