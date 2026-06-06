import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PositionService } from './position.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionController {
  constructor(private positionService: PositionService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('urgency') urgency?: string,
    @Query('projectId') projectId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.positionService.findAll({
      status,
      urgency,
      projectId: projectId ? parseInt(projectId) : undefined,
      keyword,
    });
  }

  @Post()
  async create(
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.positionService.create(body, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.positionService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.positionService.update(id, body, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.positionService.remove(id, user.id);
  }

  @Post(':id/candidates')
  async addCandidate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.positionService.addCandidate(id, body, user.id);
  }

  @Get(':id/candidates')
  async getCandidates(@Param('id', ParseIntPipe) id: number) {
    return this.positionService.getCandidates(id);
  }
}
