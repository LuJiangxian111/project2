import { ISkill, SkillContext } from './skill-registry';

export class DashboardSkill implements ISkill {
  name = 'dashboard';
  description = '数据统计：查看仪表盘统计数据';
  category = 'analytics';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'get_dashboard_stats',
        description: '获取仪表盘统计数据，包括项目数、岗位数、候选人数等',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'get_dashboard_stats': {
        const totalProjects = await ctx.projectRepository.count();
        const totalPositions = await ctx.positionRepository.count();
        const totalCandidates = await ctx.candidateRepository.count();
        const openPositions = await ctx.positionRepository.count({ where: { status: 'open' } });
        const filledPositions = await ctx.positionRepository.count({ where: { status: 'filled' } });
        const partialPositions = await ctx.positionRepository.count({ where: { status: 'partial' } });
        const closedPositions = await ctx.positionRepository.count({ where: { status: 'closed' } });

        const allCandidates = await ctx.candidateRepository.find();
        const candidatesByWorkStatus: Record<string, number> = {};
        for (const c of allCandidates) {
          const ws = c.workStatus || '未知';
          candidatesByWorkStatus[ws] = (candidatesByWorkStatus[ws] || 0) + 1;
        }

        const urgentPositions = await ctx.positionRepository.count({ where: { urgency: 'critical' } });
        const highUrgencyPositions = await ctx.positionRepository.count({ where: { urgency: 'high' } });
        const totalAssignments = await ctx.candidatePositionRepository.count();

        return {
          totalProjects, totalPositions, totalCandidates,
          openPositions, filledPositions, partialPositions, closedPositions,
          urgentPositions, highUrgencyPositions, totalAssignments,
          candidatesByWorkStatus,
        };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
