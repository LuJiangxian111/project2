import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { MessageBoardService } from './message-board.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('message-board')
export class MessageBoardController {
  constructor(private messageBoardService: MessageBoardService) {}

  @Get()
  async findAll() {
    return this.messageBoardService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: Partial<any>, @CurrentUser() user: any) {
    return this.messageBoardService.create({
      ...body,
      userId: user.id,
      nickname: body.nickname || user.nickname || user.name || user.username || '',
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.messageBoardService.remove(id);
  }
}
