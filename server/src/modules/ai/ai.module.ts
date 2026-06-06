import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { User } from '../../entities/user.entity';
import { Position } from '../../entities/position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Project } from '../../entities/project.entity';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Position, Candidate, Project]),
    LogModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
