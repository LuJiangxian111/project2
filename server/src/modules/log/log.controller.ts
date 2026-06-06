import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogService } from './log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.logService.findAll({
      userId: userId ? parseInt(userId) : undefined,
      action,
      entity,
      startDate,
      endDate,
    });
  }
}
