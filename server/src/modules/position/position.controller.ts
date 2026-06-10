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
import { CandidateService } from '../candidate/candidate.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionController {
  constructor(
    private positionService: PositionService,
    private candidateService: CandidateService,
  ) {}

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
    console.log('[Position] create body keys:', Object.keys(body), 'projectId:', body.projectId);
    try {
      const result = await this.positionService.create(body, user.id);
      return result;
    } catch (err: any) {
      console.error('[Position] create error:', err?.message || err);
      throw err;
    }
  }

  @Post('batch-import')
  async batchImport(
    @Body() body: { items: any[]; projectId: number },
    @CurrentUser() user: any,
  ) {
    const { items, projectId } = body;
    console.log(`[Position] batch-import: ${items?.length || 0} items, projectId=${projectId}`);
    let success = 0;
    let failed = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = { ...items[i], projectId };
        const requirementNumber = item.requirementNumber;
        // 查找同项目下需求编号相同的岗位
        if (requirementNumber) {
          const existing = await this.positionService.findByRequirementNumber(
            requirementNumber,
            projectId,
          );
          if (existing) {
            // 覆盖更新，保留候选人信息
            await this.positionService.update(existing.id, item, user.id);
            updated++;
            success++;
            continue;
          }
        }
        // 不存在则新建
        await this.positionService.create(item, user.id);
        success++;
      } catch (err: any) {
        failed++;
        const errMsg = `第${i + 1}条(${items[i]?.positionDuty || items[i]?.requirementNumber || '未知'}): ${err?.message || '未知错误'}`;
        errors.push(errMsg);
        console.error(`[Position] batch-import error: ${errMsg}`);
      }
    }

    console.log(`[Position] batch-import done: success=${success}, updated=${updated}, failed=${failed}`);
    return { success, failed, updated, errors };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.positionService.findOne(id);
  }

  @Put('batch/update')
  async batchUpdate(
    @Body() body: { ids: number[]; data: Partial<any> },
    @CurrentUser() user: any,
  ) {
    return this.positionService.batchUpdate(body.ids, body.data, user.id);
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

  @Post(':id/candidates/batch-import')
  async batchImportCandidates(
    @Param('id', ParseIntPipe) positionId: number,
    @Body() body: { items: any[] },
    @CurrentUser() user: any,
  ) {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < body.items.length; i++) {
      try {
        await this.positionService.addCandidate(positionId, body.items[i], user.id);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`第${i + 1}条(${body.items[i].name || '未知'}): ${err?.message || '未知错误'}`);
      }
    }

    return { success, failed, errors };
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

  @Delete(':id/candidates/:cpId')
  async removeCandidate(
    @Param('id', ParseIntPipe) id: number,
    @Param('cpId', ParseIntPipe) cpId: number,
    @CurrentUser() user: any,
  ) {
    return this.positionService.removeCandidate(cpId, user.id);
  }

  @Post(':id/candidates/batch-remove')
  async batchRemoveCandidates(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { cpIds: number[] },
    @CurrentUser() user: any,
  ) {
    return this.positionService.batchRemoveCandidates(body.cpIds, user.id);
  }

  @Put('candidate-position/:cpId/status')
  async updateCandidatePositionStatus(
    @Param('cpId', ParseIntPipe) cpId: number,
    @Body() body: { status: string },
    @CurrentUser() user: any,
  ) {
    return this.candidateService.updateCandidatePositionStatus(
      cpId,
      body.status,
      user.id,
    );
  }
}
