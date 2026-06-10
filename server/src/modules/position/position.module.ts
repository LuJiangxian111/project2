import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { CandidateService } from '../candidate/candidate.service';
import { Position } from '../../entities/position.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { LogModule } from '../log/log.module';
import { AiModule } from '../ai/ai.module';
import { SocketModule } from '../socket/socket.module';
import { NoticeModule } from '../notice/notice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, CandidatePosition, Candidate]),
    LogModule,
    AiModule,
    SocketModule,
    NoticeModule,
  ],
  controllers: [PositionController],
  providers: [PositionService, CandidateService],
  exports: [PositionService],
})
export class PositionModule {}
