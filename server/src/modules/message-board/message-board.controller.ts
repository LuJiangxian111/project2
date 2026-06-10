import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { MessageBoardService } from './message-board.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('message-board')
export class MessageBoardController {
  constructor(private messageBoardService: MessageBoardService) {}

  @Get()
  async findAll() {
    return this.messageBoardService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: Partial<any>) {
    return this.messageBoardService.create(body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.messageBoardService.remove(id);
  }
}
