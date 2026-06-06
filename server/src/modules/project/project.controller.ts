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
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('managerId') managerId?: string,
  ) {
    return this.projectService.findAll({
      status,
      keyword,
      managerId: managerId ? parseInt(managerId) : undefined,
    });
  }

  @Post()
  async create(
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.projectService.create(body, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<any>,
    @CurrentUser() user: any,
  ) {
    return this.projectService.update(id, body, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.projectService.remove(id, user.id);
  }

  @Get(':id/positions')
  async getPositions(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getPositions(id);
  }
}
