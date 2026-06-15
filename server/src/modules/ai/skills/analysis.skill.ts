import { ISkill, SkillContext } from './skill-registry';

export class AnalysisSkill implements ISkill {
  name = 'analysis';
  description = 'AI分析：招聘风险分析、生成招聘报告';
  category = 'analytics';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'analyze_risk',
        description: '分析招聘风险',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'generate_report',
        description: '生成招聘报告',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['position', 'project'], description: '报告类型' },
            positionId: { type: 'number', description: '岗位ID（type为position时必填）' },
            projectId: { type: 'number', description: '项目ID（type为project时必填）' },
          },
          required: ['type'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'analyze_risk': {
        return ctx.aiService.analyzeRisk({}, ctx.userId);
      }
      case 'generate_report': {
        const params: any = {};
        if (args.type === 'position') params.positionId = args.positionId;
        if (args.type === 'project') params.projectId = args.projectId;
        return ctx.aiService.generateReport(args.type, params, ctx.userId);
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
