import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { CandidateService } from '../candidate/candidate.service';
import { Position } from '../../entities/position.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { LogModule } from '../log/log.module';
import { AiModule } from '../ai/ai.module';
import { SocketModule } from '../socket/socket.module';
import { NoticeModule } from '../notice/notice.module';
import { DiscussionModule } from '../discussion/discussion.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, CandidatePosition, Candidate, Project, User]),
    LogModule,
    AiModule,
    SocketModule,
    NoticeModule,
    forwardRef(() => DiscussionModule),
  ],
  controllers: [PositionController],
  providers: [PositionService, CandidateService],
  exports: [PositionService],
})
export class PositionModule {}
