import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ExternalApiController } from './external-api.controller';
import { ApiKey } from '../../entities/api-key.entity';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { LogModule } from '../log/log.module';
import { ProjectModule } from '../project/project.module';
import { PositionModule } from '../position/position.module';
import { CandidateModule } from '../candidate/candidate.module';
import { InterviewModule } from '../interview/interview.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    LogModule,
    ProjectModule,
    PositionModule,
    CandidateModule,
    InterviewModule,
    AiModule,
  ],
  controllers: [ApiKeyController, ExternalApiController],
  providers: [ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}
