import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { Interview } from '../../entities/interview.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { LogModule } from '../log/log.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Interview, CandidatePosition]),
    LogModule,
    AiModule,
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
