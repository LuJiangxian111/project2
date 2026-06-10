import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageBoard } from '../../entities/message-board.entity';

@Injectable()
export class MessageBoardService {
  constructor(
    @InjectRepository(MessageBoard)
    private messageBoardRepository: Repository<MessageBoard>,
  ) {}

  async findAll() {
    // 只查顶级留言，子留言通过 replies 关联加载
    return this.messageBoardRepository.find({
      where: { visible: true, parentId: null as any },
      relations: ['replies'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: Partial<MessageBoard>) {
    const msg = this.messageBoardRepository.create(data);
    return this.messageBoardRepository.save(msg);
  }

  async remove(id: number) {
    await this.messageBoardRepository.update(id, { visible: false });
    return { message: '删除成功' };
  }
}
