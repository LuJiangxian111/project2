import { ISkill, SkillContext } from './skill-registry';

export class ResumeSkill implements ISkill {
  name = 'resume';
  description = '简历管理：为候选人上传简历文件';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'upload_candidate_resume',
        description: '为候选人上传简历文件。根据候选人姓名匹配候选人，将简历文件保存到服务器并更新候选人的简历链接。如果候选人已有简历，新简历将覆盖旧简历。支持批量上传，传入resumes数组每个元素包含candidateName和resumeUrl（已保存的文件路径）。resumeUrl请使用系统提供的保存路径。',
        parameters: {
          type: 'object',
          properties: {
            resumes: {
              type: 'array',
              description: '简历上传信息数组',
              items: {
                type: 'object',
                properties: {
                  candidateName: { type: 'string', description: '候选人姓名' },
                  resumeUrl: { type: 'string', description: '已保存的简历文件路径，如/uploads/resumes/xxx.pdf' },
                  positionId: { type: 'number', description: '岗位ID（可选）' },
                },
                required: ['candidateName', 'resumeUrl'],
              },
            },
          },
          required: ['resumes'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'upload_candidate_resume': {
        const resumes: { candidateName: string; resumeUrl: string; positionId?: number }[] = args.resumes || [];
        const results: { candidateName: string; success: boolean; message: string }[] = [];

        for (const resume of resumes) {
          try {
            if (!resume.resumeUrl) {
              results.push({ candidateName: resume.candidateName, success: false, message: '缺少简历文件路径' });
              continue;
            }

            const candidates = await ctx.candidateRepository
              .createQueryBuilder('c')
              .where('c.name LIKE :name', { name: `%${resume.candidateName}%` })
              .getMany();

            if (candidates.length === 0) {
              results.push({ candidateName: resume.candidateName, success: false, message: '未找到匹配的候选人' });
              continue;
            }

            const candidate = candidates[0];
            const oldResumeUrl = candidate.resumeUrl;

            candidate.resumeUrl = resume.resumeUrl;
            await ctx.candidateRepository.save(candidate);

            const cps = await ctx.candidatePositionRepository.find({
              where: { candidateId: candidate.id },
            });
            for (const cp of cps) {
              cp.resumeUrl = resume.resumeUrl;
              await ctx.candidatePositionRepository.save(cp);
            }

            results.push({
              candidateName: resume.candidateName,
              success: true,
              message: `已为候选人「${candidate.name}」上传简历${oldResumeUrl ? '（覆盖旧简历）' : ''}，简历路径: ${resume.resumeUrl}`
            });
          } catch (err: any) {
            results.push({ candidateName: resume.candidateName, success: false, message: err.message || '上传失败' });
          }
        }

        const successCount = results.filter(r => r.success).length;
        return {
          total: resumes.length,
          success: successCount,
          failed: results.length - successCount,
          details: results,
          message: `简历上传完成：成功${successCount}个，失败${results.length - successCount}个`
        };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
