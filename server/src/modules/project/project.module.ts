import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from '../../entities/project.entity';
import { LogModule } from '../log/log.module';
import { SocketModule } from '../socket/socket.module';
import { DiscussionModule } from '../discussion/discussion.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), LogModule, SocketModule, forwardRef(() => DiscussionModule)],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
