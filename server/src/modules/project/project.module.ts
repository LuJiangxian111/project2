import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { LogModule } from '../log/log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), LogModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
