import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { PositionModule } from './modules/position/position.module';
import { CandidateModule } from './modules/candidate/candidate.module';
import { InterviewModule } from './modules/interview/interview.module';
import { AiModule } from './modules/ai/ai.module';
import { LogModule } from './modules/log/log.module';
import { SocketModule } from './modules/socket/socket.module';
import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { Position } from './entities/position.entity';
import { Candidate } from './entities/candidate.entity';
import { CandidatePosition } from './entities/candidate-position.entity';
import { Interview } from './entities/interview.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyModule } from './modules/api-key/api-key.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: process.env.DB_TYPE === 'mysql' ? 'mysql' : 'sqlite',
      host: process.env.DB_TYPE === 'mysql' ? process.env.DB_HOST : undefined,
      port: process.env.DB_TYPE === 'mysql' ? parseInt(process.env.DB_PORT || '3306') : undefined,
      username: process.env.DB_TYPE === 'mysql' ? process.env.DB_USERNAME : undefined,
      password: process.env.DB_TYPE === 'mysql' ? process.env.DB_PASSWORD : undefined,
      database: process.env.DB_TYPE === 'mysql' ? process.env.DB_DATABASE : ':memory:',
      entities: [
        User,
        Project,
        Position,
        Candidate,
        CandidatePosition,
        Interview,
        AuditLog,
        ApiKey,
      ],
      synchronize: true,
      logging: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    UserModule,
    ProjectModule,
    PositionModule,
    CandidateModule,
    InterviewModule,
    AiModule,
    LogModule,
    SocketModule,
    ApiKeyModule,
  ],
})
export class AppModule {}