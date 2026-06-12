import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MessageBoard } from '../../entities/message-board.entity';
import { NoticeService } from '../notice/notice.service';

@Injectable()
export class MessageBoardService {
  constructor(
    @InjectRepository(MessageBoard)
    private messageBoardRepository: Repository<MessageBoard>,
    private noticeService: NoticeService,
  ) {}

  async findAll() {
    return this.messageBoardRepository.find({
      where: { visible: true, parentId: IsNull() },
      relations: ['replies'],
      order: { pinned: 'DESC', createdAt: 'DESC' },
    });
  }

  async togglePin(id: number, pinned: boolean) {
    await this.messageBoardRepository.update(id, { pinned });
    return { id, pinned };
  }

  async create(data: Partial<MessageBoard>) {
    const msg = this.messageBoardRepository.create(data);
    const saved = await this.messageBoardRepository.save(msg);

    // 如果是回复，通知父留言作者
    if (saved.parentId) {
      const parent = await this.messageBoardRepository.findOne({ where: { id: saved.parentId } });
      if (parent && parent.userId && parent.userId !== saved.userId) {
        this.noticeService.createSystemNotice(
          '留言回复通知',
          `${saved.nickname || '有人'}回复了您的留言：「${saved.content.length > 30 ? saved.content.substring(0, 30) + '...' : saved.content}」`,
          parent.userId,
        ).catch(() => {});
      }
    }

    return saved;
  }

  async remove(id: number) {
    await this.messageBoardRepository.update(id, { visible: false });
    return { message: '删除成功' };
  }
}
