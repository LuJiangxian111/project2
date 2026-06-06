import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class LogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: number,
    action: string,
    entity: string,
    entityId: number | null,
    detail?: any,
  ) {
    const log = this.auditLogRepository.create({
      userId,
      action,
      entity,
      entityId,
      detail: detail ? JSON.stringify(detail) : null,
    });
    return this.auditLogRepository.save(log);
  }

  async findAll(query?: {
    userId?: number;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

    if (query?.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query?.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query?.entity) {
      qb.andWhere('log.entity = :entity', { entity: query.entity });
    }
    if (query?.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query?.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: query.endDate });
    }

    qb.orderBy('log.createdAt', 'DESC');
    return qb.getMany();
  }
}
