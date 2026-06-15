import { ISkill, SkillContext } from './skill-registry';

export class InterviewSkill implements ISkill {
  name = 'interview';
  description = '面试管理：智能安排面试，创建面试安排，查看面试列表';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'list_interviews',
        description: '获取面试列表',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'schedule_interview',
        description: '智能安排面试。根据候选人姓名或电话查找候选人，根据项目和岗位信息定位候选人岗位关联，然后创建面试安排。如果找不到候选人或岗位关联，会返回错误提示需要补充信息。',
        parameters: {
          type: 'object',
          properties: {
            candidateName: { type: 'string', description: '候选人姓名' },
            candidatePhone: { type: 'string', description: '候选人电话号码（可选，用于精确匹配）' },
            projectName: { type: 'string', description: '项目名称（可选）' },
            positionName: { type: 'string', description: '岗位名称/岗位职务（可选）' },
            interviewType: { type: 'string', enum: ['online', 'onsite', 'phone', 'video'], description: '面试形式：online=线上, onsite=现场, phone=电话, video=视频' },
            interviewDate: { type: 'string', description: '面试日期时间，如2024-01-15T10:00:00 或 2024-01-15 10:00' },
            round: { type: 'number', description: '面试轮次，默认1' },
            meetingLink: { type: 'string', description: '会议链接或面试地点信息（可选）' },
          },
          required: ['candidateName', 'interviewType', 'interviewDate'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_interview',
        description: '通过候选人ID和岗位ID直接创建面试安排（需要已知精确ID时使用）',
        parameters: {
          type: 'object',
          properties: {
            candidateId: { type: 'number', description: '候选人ID' },
            positionId: { type: 'number', description: '岗位ID' },
            interviewDate: { type: 'string', description: '面试日期时间，如2024-01-15T10:00:00' },
            round: { type: 'number', description: '面试轮次' },
            interviewerId: { type: 'number', description: '面试官用户ID' },
            interviewType: { type: 'string', description: '面试形式：online/onsite/phone/video' },
            meetingLink: { type: 'string', description: '会议链接或面试地点信息' },
          },
          required: ['candidateId', 'positionId', 'interviewDate', 'round'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'schedule_interview_by_cp',
        description: '为候选人安排面试（通过候选人-岗位关联ID）。会自动将候选人状态更新为待面试，并通知候选人上传者。面试状态：pending(待面试)、pass(面试通过)、fail(面试不通过)、cancel(放弃面试)。',
        parameters: {
          type: 'object',
          properties: {
            candidatePositionId: { type: 'number', description: '候选人-岗位关联ID（candidate_position的id）' },
            interviewType: { type: 'string', description: '面试形式：online(线上)、onsite(现场)、phone(电话)、video(视频)', enum: ['online', 'onsite', 'phone', 'video'] },
            scheduledAt: { type: 'string', description: '面试时间，格式：YYYY-MM-DD HH:mm' },
            meetingLink: { type: 'string', description: '会议链接/信息（如腾讯会议链接、面试地点等）' },
            round: { type: 'number', description: '面试轮次，默认1' },
          },
          required: ['candidatePositionId', 'interviewType', 'scheduledAt'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'list_interviews': {
        const interviews = await ctx.interviewRepository.find({
          relations: ['candidatePosition', 'candidatePosition.candidate', 'candidatePosition.position', 'interviewer'],
          order: { createdAt: 'DESC' },
        });
        return interviews.map(i => ({
          id: i.id,
          candidatePositionId: i.candidatePositionId,
          candidateName: (i.candidatePosition as any)?.candidate?.name || '未知',
          positionDuty: (i.candidatePosition as any)?.position?.positionDuty || '未知',
          round: i.round,
          interviewerName: i.interviewer?.username || '未知',
          scheduledAt: i.scheduledAt,
          result: i.result,
          score: i.score,
        }));
      }
      case 'schedule_interview': {
        const candidateQb = ctx.candidateRepository.createQueryBuilder('c');
        candidateQb.where('c.name = :name', { name: args.candidateName });
        if (args.candidatePhone) {
          candidateQb.orWhere('c.contactPhone = :phone', { phone: args.candidatePhone });
        }
        const matchedCandidates = await candidateQb.getMany();

        if (matchedCandidates.length === 0) {
          return { error: `未找到候选人"${args.candidateName}"，请确认姓名是否正确，或先添加该候选人` };
        }

        const candidateIds = matchedCandidates.map(c => c.id);
        const cpQb = ctx.candidatePositionRepository.createQueryBuilder('cp')
          .leftJoinAndSelect('cp.candidate', 'candidate')
          .leftJoinAndSelect('cp.position', 'position')
          .leftJoinAndSelect('position.project', 'project')
          .where('cp.candidateId IN (:...candidateIds)', { candidateIds });

        if (args.positionName) {
          cpQb.andWhere('position.positionDuty LIKE :posName', { posName: `%${args.positionName}%` });
        }
        if (args.projectName) {
          cpQb.andWhere('project.name LIKE :projName', { projName: `%${args.projectName}%` });
        }

        const candidatePositions = await cpQb.getMany();

        if (candidatePositions.length === 0) {
          const allCps = await ctx.candidatePositionRepository.find({
            where: candidateIds.map(id => ({ candidateId: id })),
            relations: ['candidate', 'position', 'position.project'],
          });

          if (allCps.length === 0) {
            return { error: `候选人"${args.candidateName}"尚未分配到任何岗位，请先将候选人分配到岗位后再安排面试` };
          }

          if (allCps.length === 1) {
            const cp = allCps[0];
            const interview = ctx.interviewRepository.create({
              candidatePositionId: cp.id,
              round: args.round || 1,
              interviewerId: ctx.userId,
              interviewType: args.interviewType || 'online',
              scheduledAt: new Date(args.interviewDate),
              meetingLink: args.meetingLink || null,
              result: 'pending',
            });
            const result = await ctx.interviewRepository.save(interview);

            if (cp.status !== 'pending_interview') {
              cp.status = 'pending_interview';
              await ctx.candidatePositionRepository.save(cp);
            }

            return {
              id: result.id,
              candidateName: (cp as any).candidate?.name || args.candidateName,
              positionDuty: (cp as any).position?.positionDuty || '未知',
              projectName: (cp as any).position?.project?.name || '未知',
              interviewType: args.interviewType,
              scheduledAt: result.scheduledAt,
              round: result.round,
              message: '面试安排成功',
            };
          }

          const cpList = allCps.map(cp => ({
            cpId: cp.id,
            candidateName: (cp as any).candidate?.name,
            positionDuty: (cp as any).position?.positionDuty,
            projectName: (cp as any).position?.project?.name,
          }));
          return {
            error: `候选人"${args.candidateName}"关联了多个岗位，请指定项目和岗位`,
            availablePositions: cpList,
          };
        }

        if (candidatePositions.length === 1) {
          const cp = candidatePositions[0];
          const interview = ctx.interviewRepository.create({
            candidatePositionId: cp.id,
            round: args.round || 1,
            interviewerId: ctx.userId,
            interviewType: args.interviewType || 'online',
            scheduledAt: new Date(args.interviewDate),
            meetingLink: args.meetingLink || null,
            result: 'pending',
          });
          const result = await ctx.interviewRepository.save(interview);

          if (cp.status !== 'pending_interview') {
            cp.status = 'pending_interview';
            await ctx.candidatePositionRepository.save(cp);
          }

          return {
            id: result.id,
            candidateName: (cp as any).candidate?.name || args.candidateName,
            positionDuty: (cp as any).position?.positionDuty || '未知',
            projectName: (cp as any).position?.project?.name || '未知',
            interviewType: args.interviewType,
            scheduledAt: result.scheduledAt,
            round: result.round,
            message: '面试安排成功',
          };
        }

        const cpList = candidatePositions.map(cp => ({
          cpId: cp.id,
          candidateName: (cp as any).candidate?.name,
          positionDuty: (cp as any).position?.positionDuty,
          projectName: (cp as any).position?.project?.name,
        }));
        return {
          error: `匹配到多个岗位关联，请进一步指定项目和岗位`,
          availablePositions: cpList,
        };
      }
      case 'create_interview': {
        let cp = await ctx.candidatePositionRepository.findOne({
          where: { candidateId: args.candidateId, positionId: args.positionId },
        });
        if (!cp) {
          cp = ctx.candidatePositionRepository.create({
            candidateId: args.candidateId,
            positionId: args.positionId,
            matchScore: 0,
            status: 'pending_interview',
            recommendedAt: new Date(),
          });
          cp = await ctx.candidatePositionRepository.save(cp);
        }
        const interview = ctx.interviewRepository.create({
          candidatePositionId: cp.id,
          round: args.round || 1,
          interviewerId: args.interviewerId || ctx.userId,
          interviewType: args.interviewType || 'online',
          scheduledAt: new Date(args.interviewDate),
          meetingLink: args.meetingLink || null,
          result: 'pending',
        });
        const result = await ctx.interviewRepository.save(interview);

        if (cp.status !== 'pending_interview') {
          cp.status = 'pending_interview';
          await ctx.candidatePositionRepository.save(cp);
        }

        return { id: result.id, candidateId: args.candidateId, positionId: args.positionId, scheduledAt: result.scheduledAt, round: result.round, interviewType: args.interviewType, message: '面试安排创建成功' };
      }
      case 'schedule_interview_by_cp': {
        const cpId = args.candidatePositionId;
        if (!cpId) return { error: '请指定候选人-岗位关联ID' };

        const cp = await ctx.candidatePositionRepository.findOne({
          where: { id: cpId },
          relations: ['candidate', 'position'],
        });
        if (!cp) return { error: '未找到该候选人-岗位关联记录' };

        const interview = ctx.interviewRepository.create({
          candidatePositionId: cpId,
          interviewType: args.interviewType || 'online',
          scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : new Date(),
          meetingLink: args.meetingLink || '',
          round: args.round || 1,
          result: 'pending',
        });
        await ctx.interviewRepository.save(interview);

        if (cp.status !== 'pending_interview') {
          cp.status = 'pending_interview';
          await ctx.candidatePositionRepository.save(cp);
        }

        const typeLabels: Record<string, string> = { online: '线上', onsite: '现场', phone: '电话', video: '视频' };
        return {
          success: true,
          interviewId: interview.id,
          candidateName: cp.candidate?.name,
          positionDuty: cp.position?.positionDuty,
          interviewType: typeLabels[args.interviewType] || args.interviewType,
          scheduledAt: interview.scheduledAt,
          meetingLink: interview.meetingLink,
          message: `已为候选人「${cp.candidate?.name || '未知'}」安排${typeLabels[args.interviewType] || ''}面试，岗位：${cp.position?.positionDuty || '未知'}，时间：${interview.scheduledAt.toLocaleString('zh-CN')}`
        };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
