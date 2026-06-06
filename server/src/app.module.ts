import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { PositionModule } from './modules/position/position.module';
import { CandidateModule } from './modules/candidate/candidate.module';
import { InterviewModule } from './modules/interview/interview.module';
import { AiModule } from './modules/ai/ai.module';
import { LogModule } from './modules/log/log.module';
import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { Position } from './entities/position.entity';
import { Candidate } from './entities/candidate.entity';
import { CandidatePosition } from './entities/candidate-position.entity';
import { Interview } from './entities/interview.entity';
import { AuditLog } from './entities/audit-log.entity';
import * as path from 'path';
import * as fs from 'fs';

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: dbPath,
      autoSave: true,
      entities: [
        User,
        Project,
        Position,
        Candidate,
        CandidatePosition,
        Interview,
        AuditLog,
      ],
      synchronize: true,
    }),
    AuthModule,
    UserModule,
    ProjectModule,
    PositionModule,
    CandidateModule,
    InterviewModule,
    AiModule,
    LogModule,
  ],
})
export class AppModule {}
