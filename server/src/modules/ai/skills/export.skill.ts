import { ISkill, SkillContext } from './skill-registry';
import { Candidate } from '../../../entities/candidate.entity';

export class ExportSkill implements ISkill {
  name = 'export';
  description = '数据导出：导出岗位和候选人数据为CSV格式';
  category = 'data';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'export_positions_csv',
        description: '导出岗位数据为CSV格式',
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'number', description: '项目ID（可选，筛选指定项目的岗位）' } },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'export_candidates_csv',
        description: '导出候选人数据为CSV格式',
        parameters: {
          type: 'object',
          properties: {
            projectId: { type: 'number', description: '项目ID（可选，筛选指定项目的候选人）' },
            positionId: { type: 'number', description: '岗位ID（可选，筛选指定岗位的候选人）' },
          },
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'export_positions_csv': {
        const where: any = {};
        if (args.projectId) where.projectId = args.projectId;
        const positions = await ctx.positionRepository.find({ where });
        const headers = 'ID,系统,部门,岗位职务,岗位类型,技术领域,紧急程度,状态,需求人数,已录用人数,地区';
        const rows = positions.map(p =>
          `${p.id},${p.systemName},${p.department},${p.positionDuty},${p.positionType},${p.techDomain},${p.urgency},${p.status},${p.requiredCount},${p.hiredCount},${p.region}`
        );
        const csv = [headers, ...rows].join('\n');
        return { csv, count: positions.length, message: `已生成${positions.length}条岗位CSV数据` };
      }
      case 'export_candidates_csv': {
        let candidates: Candidate[];
        let statusMap: Record<number, string> = {};
        if (args.positionId) {
          const cps = await ctx.candidatePositionRepository.find({
            where: { positionId: args.positionId },
            relations: ['candidate'],
          });
          candidates = cps.map(cp => cp.candidate).filter(Boolean);
          for (const cp of cps) {
            if (cp.candidateId) statusMap[cp.candidateId] = cp.status;
          }
        } else if (args.projectId) {
          const positions = await ctx.positionRepository.find({
            where: { projectId: args.projectId },
          });
          const positionIds = positions.map(p => p.id);
          const cps = await ctx.candidatePositionRepository.find({
            where: positionIds.map(pid => ({ positionId: pid })),
            relations: ['candidate'],
          });
          candidates = cps.map(cp => cp.candidate).filter(Boolean);
          for (const cp of cps) {
            if (cp.candidateId) statusMap[cp.candidateId] = cp.status;
          }
        } else {
          candidates = await ctx.candidateRepository.find();
        }
        const headers = 'ID,姓名,性别,学历,领域年限,工作状态,期望薪资,供应商,联系电话,邮箱,简历链接,状态';
        const rows = candidates.map(c =>
          `${c.id},${c.name},${c.gender || ''},${c.education || ''},${c.domainYears || ''},${c.workStatus || ''},${c.expectedSalary || ''},${c.supplier || ''},${c.contactPhone || ''},${c.contactEmail || ''},${c.resumeUrl || ''},${statusMap[c.id] || ''}`
        );
        const csv = [headers, ...rows].join('\n');
        return { csv, count: candidates.length, message: `已生成${candidates.length}条候选人CSV数据` };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
