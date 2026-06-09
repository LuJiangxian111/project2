import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { Candidate } from '../../entities/candidate.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Position } from '../../entities/position.entity';
import { LogModule } from '../log/log.module';
import { AiModule } from '../ai/ai.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candidate, CandidatePosition, Position]),
    LogModule,
    AiModule,
    SocketModule,
  ],
  controllers: [CandidateController],
  providers: [CandidateService],
  exports: [CandidateService],
})
export class CandidateModule {}
