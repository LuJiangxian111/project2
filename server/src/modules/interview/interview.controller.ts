import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { InterviewService } from './interview.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private interviewService: InterviewService) {}

  @Get()
  async findAll(
    @Query('interviewerId') interviewerId?: string,
    @Query('result') result?: string,
    @Query('candidatePositionId') candidatePositionId?: string,
  ) {
    return this.interviewService.findAll({
      interviewerId: interviewerId ? parseInt(interviewerId) : undefined,
      result,
      candidatePositionId: candidatePositionId
        ? parseInt(candidatePositionId)
        : undefined,
    });
  }

  @Post()
  async create(
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.interviewService.create(body, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.interviewService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.interviewService.update(id, body, user.id);
  }

  @Post(':id/generate-questions')
  async generateQuestions(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.interviewService.generateQuestions(id, user.id);
  }
}
