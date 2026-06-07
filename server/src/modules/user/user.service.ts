import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(query?: { role?: string; keyword?: string }) {
    const qb = this.userRepository.createQueryBuilder('user');

    if (query?.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query?.keyword) {
      qb.andWhere(
        '(user.name LIKE :keyword OR user.username LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }

    const users = await qb.getMany();
    return users.map((u) => {
      const { password, ...result } = u;
      return result;
    });
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const { password, ...result } = user;
    return result;
  }

  async update(id: number, data: Partial<User>) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }
    Object.assign(user, data);
    await this.userRepository.save(user);
    const { password, ...result } = user;
    return result;
  }

  async updateLlmConfig(
    id: number,
    config: { llmApiKey?: string; llmBaseUrl?: string; llmModel?: string },
  ) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (config.llmApiKey !== undefined) user.llmApiKey = config.llmApiKey;
    if (config.llmBaseUrl !== undefined) user.llmBaseUrl = config.llmBaseUrl;
    if (config.llmModel !== undefined) user.llmModel = config.llmModel;
    await this.userRepository.save(user);
    const { password, ...result } = user;
    return result;
  }

  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);
    return { success: true };
  }
}
