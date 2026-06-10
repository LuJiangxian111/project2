import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageBoard } from '../../entities/message-board.entity';
import { MessageBoardService } from './message-board.service';
import { MessageBoardController } from './message-board.controller';
import { NoticeModule } from '../notice/notice.module';

@Module({
  imports: [TypeOrmModule.forFeature([MessageBoard]), NoticeModule],
  providers: [MessageBoardService],
  controllers: [MessageBoardController],
})
export class MessageBoardModule {}
