import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { InterviewReminderService } from './interview-reminder.service';
import { Interview } from '../../entities/interview.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { LogModule } from '../log/log.module';
import { AiModule } from '../ai/ai.module';
import { NoticeModule } from '../notice/notice.module';
import { SocketModule } from '../socket/socket.module';
import { DiscussionModule } from '../discussion/discussion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Interview, CandidatePosition]),
    LogModule,
    AiModule,
    NoticeModule,
    SocketModule,
    DiscussionModule,
  ],
  controllers: [InterviewController],
  providers: [InterviewService, InterviewReminderService],
  exports: [InterviewService],
})
export class InterviewModule {}
