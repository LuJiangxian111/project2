import { ISkill, SkillContext } from './skill-registry';

export class AssignmentSkill implements ISkill {
  name = 'assignment';
  description = '分配管理：将候选人分配到岗位，查看岗位候选人，更新候选人状态，AI匹配分析';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'assign_candidate_to_position',
        description: '将候选人分配到岗位',
        parameters: {
          type: 'object',
          properties: {
            candidateId: { type: 'number', description: '候选人ID' },
            positionId: { type: 'number', description: '岗位ID' },
          },
          required: ['candidateId', 'positionId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'list_position_candidates',
        description: '获取岗位的候选人列表，包含候选人姓名和当前状态',
        parameters: {
          type: 'object',
          properties: { positionId: { type: 'number', description: '岗位ID' } },
          required: ['positionId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_candidate_status',
        description: '更新候选人在岗位中的状态。状态可选值：pending_screen(待筛选)、screen_rejected(筛选未通过)、screen_passed(筛选通过)、pending_interview(待面试)、interview_passed(面试通过)、interview_rejected(面试未通过)、abandoned(已放弃)、pending_onboard(待入职)、onboarded(已入职)。支持批量更新，传入candidateIds数组可同时更新多个候选人。',
        parameters: {
          type: 'object',
          properties: {
            candidateIds: { type: 'array', items: { type: 'number' }, description: '候选人ID数组，支持批量' },
            positionId: { type: 'number', description: '岗位ID' },
            status: { type: 'string', description: '新状态，如：interview_passed、screen_rejected、onboarded等' },
          },
          required: ['candidateIds', 'positionId', 'status'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'match_candidate',
        description: 'AI匹配候选人与岗位',
        parameters: {
          type: 'object',
          properties: {
            candidateId: { type: 'number', description: '候选人ID' },
            positionId: { type: 'number', description: '岗位ID' },
          },
          required: ['candidateId', 'positionId'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'assign_candidate_to_position': {
        const existing = await ctx.candidatePositionRepository.findOne({
          where: { candidateId: args.candidateId, positionId: args.positionId },
        });
        if (existing) return { error: '该候选人已分配到此岗位' };
        // 强制推荐人为操作者
        const uploader = await ctx.userRepository.findOne({ where: { id: ctx.userId } });
        const uploaderName = uploader?.name || uploader?.username || '';
        const cp = ctx.candidatePositionRepository.create({
          candidateId: args.candidateId,
          positionId: args.positionId,
          matchScore: 0,
          status: 'pending_screen',
          recommendedAt: new Date(),
          recommender: uploaderName,
          recommenderId: ctx.userId,
        });
        const result = await ctx.candidatePositionRepository.save(cp);
        return { id: result.id, candidateId: args.candidateId, positionId: args.positionId, message: '候选人已分配到岗位' };
      }
      case 'list_position_candidates': {
        const cps = await ctx.candidatePositionRepository.find({
          where: { positionId: args.positionId },
          relations: ['candidate'],
        });
        return cps.map(cp => ({
          id: cp.id, candidateId: cp.candidateId, candidateName: cp.candidate?.name,
          matchScore: cp.matchScore, status: cp.status, recommendReason: cp.recommendReason,
        }));
      }
      case 'update_candidate_status': {
        const validStatuses = ['pending_screen', 'screen_rejected', 'screen_passed', 'pending_interview', 'interview_passed', 'interview_rejected', 'abandoned', 'pending_onboard', 'onboarded'];
        if (!validStatuses.includes(args.status)) {
          return { error: `无效的状态值，可选值：${validStatuses.join(', ')}` };
        }
        const candidateIds: number[] = args.candidateIds;
        const results: { candidateId: number; success: boolean; message: string }[] = [];
        for (const cid of candidateIds) {
          const cp = await ctx.candidatePositionRepository.findOne({
            where: { candidateId: cid, positionId: args.positionId },
            relations: ['candidate'],
          });
          if (!cp) {
            results.push({ candidateId: cid, success: false, message: '未找到该候选人在此岗位的记录' });
            continue;
          }
          const oldStatus = cp.status;
          cp.status = args.status;
          await ctx.candidatePositionRepository.save(cp);
          results.push({
            candidateId: cid, success: true,
            message: `${cp.candidate?.name || '候选人'}：${oldStatus} → ${args.status}`,
          });
        }
        return { updated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, details: results };
      }
      case 'match_candidate': {
        const candidate = await ctx.candidateRepository.findOne({ where: { id: args.candidateId } });
        const position = await ctx.positionRepository.findOne({ where: { id: args.positionId } });
        if (!candidate) return { error: '候选人不存在' };
        if (!position) return { error: '岗位不存在' };
        return ctx.aiService.matchCandidate(candidate, position, ctx.userId);
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
