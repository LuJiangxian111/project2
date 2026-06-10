import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from '../../entities/notice.entity';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private noticeRepository: Repository<Notice>,
  ) {}

  async findAll() {
    return this.noticeRepository.find({ relations: ['author'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    return this.noticeRepository.findOne({ where: { id }, relations: ['author'] });
  }

  async create(data: Partial<Notice>, userId: number) {
    const notice = this.noticeRepository.create({ ...data, authorId: userId });
    return this.noticeRepository.save(notice);
  }

  async update(id: number, data: Partial<Notice>) {
    await this.noticeRepository.update(id, data);
    return this.noticeRepository.findOne({ where: { id }, relations: ['author'] });
  }

  async remove(id: number) {
    await this.noticeRepository.delete(id);
    return { message: '删除成功' };
  }
}
