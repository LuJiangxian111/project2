import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionGroup } from '../../entities/discussion-group.entity';
import { DiscussionMessage } from '../../entities/discussion-message.entity';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscussionGroup, DiscussionMessage]),
    SocketModule,
  ],
  controllers: [DiscussionController],
  providers: [DiscussionService],
  exports: [DiscussionService],
})
export class DiscussionModule {}
