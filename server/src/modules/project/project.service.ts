import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { LogService } from '../log/log.service';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private logService: LogService,
  ) {}

  async findAll(query?: {
    status?: string;
    keyword?: string;
    managerId?: number;
  }) {
    const qb = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.manager', 'manager');

    if (query?.status) {
      qb.andWhere('project.status = :status', { status: query.status });
    }
    if (query?.keyword) {
      qb.andWhere('project.name LIKE :keyword', {
        keyword: `%${query.keyword}%`,
      });
    }
    if (query?.managerId) {
      qb.andWhere('project.managerId = :managerId', {
        managerId: query.managerId,
      });
    }

    qb.orderBy('project.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number) {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['manager', 'positions'],
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return project;
  }

  async create(data: Partial<Project>, userId: number) {
    const project = this.projectRepository.create(data);
    const result = await this.projectRepository.save(project);
    await this.logService.log(userId, 'create', 'project', result.id, {
      name: result.name,
    });
    return result;
  }

  async update(id: number, data: Partial<Project>, userId: number) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    Object.assign(project, data);
    const result = await this.projectRepository.save(project);
    await this.logService.log(userId, 'update', 'project', id, data);
    return result;
  }

  async remove(id: number, userId: number) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    await this.projectRepository.remove(project);
    await this.logService.log(userId, 'delete', 'project', id, {
      name: project.name,
    });
    return { message: '删除成功' };
  }

  async getPositions(projectId: number) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['positions', 'positions.creator'],
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return project.positions;
  }
}
