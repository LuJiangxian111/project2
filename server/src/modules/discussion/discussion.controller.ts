import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { DiscussionService } from './discussion.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('discussion')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  constructor(private discussionService: DiscussionService) {}

  // 获取当前用户的讨论组列表
  @Get()
  async findMyGroups(@CurrentUser() user: any) {
    return this.discussionService.findByUser(user.id);
  }

  // 获取项目的讨论组
  @Get('project/:projectId')
  async findByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.discussionService.findByProject(projectId);
  }

  // 获取讨论组消息
  @Get(':groupId/messages')
  async getMessages(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.discussionService.getMessages(
      groupId,
      limit ? parseInt(limit) : 50,
      before ? parseInt(before) : undefined,
    );
  }

  // 发送消息
  @Post(':groupId/messages')
  async sendMessage(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.discussionService.sendMessage(
      groupId,
      user.id,
      body.content,
      body.mentionIds,
      body.referenceType,
      body.referenceId,
      body.referenceData,
    );
  }

  // 添加成员
  @Post(':groupId/members')
  async addMember(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: any,
  ) {
    return this.discussionService.addMember(groupId, body.userId);
  }

  // 移除成员
  @Delete(':groupId/members/:userId')
  async removeMember(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.discussionService.removeMember(groupId, userId);
  }

  // 获取讨论组成员
  @Get(':groupId/members')
  async getMembers(
    @Param('groupId', ParseIntPipe) groupId: number,
  ) {
    return this.discussionService.getMembers(groupId);
  }
}
