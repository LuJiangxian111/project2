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
import { CandidateService } from './candidate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('candidates')
@UseGuards(JwtAuthGuard)
export class CandidateController {
  constructor(private candidateService: CandidateService) {}

  @Get()
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('source') source?: string,
  ) {
    return this.candidateService.findAll({ keyword, source });
  }

  @Get('grouped')
  async findAllGrouped(
    @Query('keyword') keyword?: string,
    @Query('projectId') projectId?: string,
    @Query('positionId') positionId?: string,
    @Query('status') status?: string,
  ) {
    return this.candidateService.findAllWithPositions({
      keyword,
      projectId: projectId ? Number(projectId) : undefined,
      positionId: positionId ? Number(positionId) : undefined,
      status,
    });
  }

  @Post()
  async create(
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.create(body, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.candidateService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.update(id, body, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.remove(id, user.id);
  }

  @Post(':id/match/:positionId')
  async matchWithPosition(
    @Param('id', ParseIntPipe) id: number,
    @Param('positionId', ParseIntPipe) positionId: number,
    @CurrentUser() user: any,
  ) {
    return this.candidateService.matchWithPosition(id, positionId, user.id);
  }
}
