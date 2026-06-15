import { ISkill, SkillContext } from './skill-registry';

// 将Excel日期序列号转换为正常日期字符串
function convertExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    return str.replace(/\//g, '-').substring(0, 10);
  }
  const num = Number(str);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + num * 86400000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

export class PositionSkill implements ISkill {
  name = 'position';
  description = '岗位管理：创建、查看、更新、删除岗位，搜索岗位，批量导入岗位数据';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'list_positions',
        description: '获取岗位列表，可按项目ID筛选。返回包含需求编号、岗位职务、部门等完整信息。',
        parameters: {
          type: 'object',
          properties: { projectId: { type: 'number', description: '项目ID（可选）' } },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_positions',
        description: '按需求编号、岗位职务、部门等关键词搜索岗位。当用户提供需求编号（如R2508209923）或岗位名称时使用此工具。',
        parameters: {
          type: 'object',
          properties: {
            requirementNumber: { type: 'string', description: '需求编号（如R2508209923）' },
            positionDuty: { type: 'string', description: '岗位职务关键词' },
            department: { type: 'string', description: '部门关键词' },
            systemName: { type: 'string', description: '系统名称关键词' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_position',
        description: '创建新岗位需求',
        parameters: {
          type: 'object',
          properties: {
            systemName: { type: 'string', description: '系统名称' },
            department: { type: 'string', description: '部门' },
            positionDuty: { type: 'string', description: '岗位职务' },
            positionType: { type: 'string', description: '岗位类型' },
            techDomain: { type: 'string', description: '技术领域' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '紧急程度' },
            requiredCount: { type: 'number', description: '需求人数' },
            region: { type: 'string', description: '地区' },
            projectId: { type: 'number', description: '所属项目ID' },
          },
          required: ['systemName', 'department', 'positionDuty', 'projectId'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_position',
        description: '更新岗位信息',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'number', description: '岗位ID' },
            systemName: { type: 'string', description: '系统名称' },
            department: { type: 'string', description: '部门' },
            positionDuty: { type: 'string', description: '岗位职务' },
            positionType: { type: 'string', description: '岗位类型' },
            techDomain: { type: 'string', description: '技术领域' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '紧急程度' },
            requiredCount: { type: 'number', description: '需求人数' },
            region: { type: 'string', description: '地区' },
            status: { type: 'string', enum: ['open', 'partial', 'filled', 'closed'], description: '岗位状态' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'delete_position',
        description: '删除岗位',
        parameters: {
          type: 'object',
          properties: { id: { type: 'number', description: '岗位ID' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_position_detail',
        description: '获取岗位详细信息，包括已分配的候选人列表',
        parameters: {
          type: 'object',
          properties: { id: { type: 'number', description: '岗位ID' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'import_positions_from_data',
        description: '智能批量导入岗位数据。系统会自动进行字段映射，将Excel列名匹配到系统标准字段（如"岗位/职位"→positionDuty, "岗位类型"→positionType, "需求人数"→requiredCount等）。传入原始数据即可，无需手动映射字段名。支持所有岗位字段：systemName(系统), department(部门), requirementNumber(需求编号), positionType(岗位类型), positionDuty(岗位职务), techDomain(技术领域), majorType(专业类型), levelDistribution(职级分布), salaryRange(薪资范围), requirements(岗位要求), responsibilities(岗位职责), domainExperience(领域经验), region(地区), deliveryForm(交付形式), positionImplementation(岗位实施), urgency(紧急程度), requiredCount(需求人数), expectedDate(期望到岗日期)。',
        parameters: {
          type: 'object',
          properties: {
            projectId: { type: 'number', description: '所属项目ID' },
            items: {
              type: 'array',
              description: '岗位数据数组，每条记录是一个对象，键名可以是Excel原始列名或系统标准字段名，系统会自动映射',
              items: {
                type: 'object',
                properties: {
                  systemName: { type: 'string', description: '系统名称' },
                  department: { type: 'string', description: '部门' },
                  requirementNumber: { type: 'string', description: '需求编号' },
                  positionDuty: { type: 'string', description: '岗位职务' },
                  positionType: { type: 'string', description: '岗位类型' },
                  techDomain: { type: 'string', description: '技术领域' },
                  majorType: { type: 'string', description: '专业类型' },
                  levelDistribution: { type: 'string', description: '职级分布' },
                  salaryRange: { type: 'string', description: '薪资范围' },
                  requirements: { type: 'string', description: '岗位要求' },
                  responsibilities: { type: 'string', description: '岗位职责' },
                  domainExperience: { type: 'string', description: '领域经验' },
                  region: { type: 'string', description: '地区' },
                  deliveryForm: { type: 'string', description: '交付形式' },
                  positionImplementation: { type: 'string', description: '岗位实施' },
                  urgency: { type: 'string', description: '紧急程度(low/medium/high/critical)' },
                  requiredCount: { type: 'number', description: '需求人数' },
                  expectedDate: { type: 'string', description: '期望到岗日期' },
                },
              },
            },
          },
          required: ['projectId', 'items'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'list_positions': {
        const where: any = {};
        if (args.projectId) where.projectId = args.projectId;
        const positions = await ctx.positionRepository.find({ where, order: { createdAt: 'DESC' } });
        return positions.map(p => ({
          id: p.id, requirementNumber: p.requirementNumber, systemName: p.systemName,
          positionDuty: p.positionDuty, department: p.department, urgency: p.urgency,
          status: p.status, requiredCount: p.requiredCount, hiredCount: p.hiredCount,
          region: p.region, positionType: p.positionType, techDomain: p.techDomain,
          salaryRange: p.salaryRange, projectId: p.projectId, deliveryForm: p.deliveryForm,
        }));
      }
      case 'search_positions': {
        const qb = ctx.positionRepository.createQueryBuilder('p');
        if (args.requirementNumber) qb.andWhere('p.requirement_number LIKE :rn', { rn: `%${args.requirementNumber}%` });
        if (args.positionDuty) qb.andWhere('p.position_duty LIKE :pd', { pd: `%${args.positionDuty}%` });
        if (args.department) qb.andWhere('p.department LIKE :dep', { dep: `%${args.department}%` });
        if (args.systemName) qb.andWhere('p.system_name LIKE :sn', { sn: `%${args.systemName}%` });
        qb.orderBy('p.created_at', 'DESC').limit(50);
        const positions = await qb.getMany();
        return positions.map(p => ({
          id: p.id, requirementNumber: p.requirementNumber, systemName: p.systemName,
          positionDuty: p.positionDuty, department: p.department, urgency: p.urgency,
          status: p.status, requiredCount: p.requiredCount, hiredCount: p.hiredCount,
          region: p.region, positionType: p.positionType, techDomain: p.techDomain,
          salaryRange: p.salaryRange, projectId: p.projectId, deliveryForm: p.deliveryForm,
          requirements: p.requirements, responsibilities: p.responsibilities,
          domainExperience: p.domainExperience,
        }));
      }
      case 'create_position': {
        const position = ctx.positionRepository.create({
          systemName: args.systemName,
          department: args.department,
          positionDuty: args.positionDuty,
          positionType: args.positionType || '未指定',
          techDomain: args.techDomain || '未指定',
          majorType: '未指定',
          levelDistribution: '未指定',
          urgency: args.urgency || 'medium',
          requiredCount: args.requiredCount || 1,
          region: args.region || '未指定',
          deliveryForm: '未指定',
          requirements: '待补充',
          responsibilities: '待补充',
          domainExperience: '待补充',
          requirementNumber: `REQ-${Date.now()}`,
          projectId: args.projectId,
          creatorId: ctx.userId,
        });
        const result = await ctx.positionRepository.save(position);
        return { id: result.id, positionDuty: result.positionDuty, message: '岗位创建成功' };
      }
      case 'update_position': {
        const position = await ctx.positionRepository.findOne({ where: { id: args.id } });
        if (!position) return { error: '岗位不存在' };
        if (args.systemName !== undefined) position.systemName = args.systemName;
        if (args.department !== undefined) position.department = args.department;
        if (args.positionDuty !== undefined) position.positionDuty = args.positionDuty;
        if (args.positionType !== undefined) position.positionType = args.positionType;
        if (args.techDomain !== undefined) position.techDomain = args.techDomain;
        if (args.urgency !== undefined) position.urgency = args.urgency;
        if (args.requiredCount !== undefined) position.requiredCount = args.requiredCount;
        if (args.region !== undefined) position.region = args.region;
        if (args.status !== undefined) position.status = args.status;
        const result = await ctx.positionRepository.save(position);
        return { id: result.id, positionDuty: result.positionDuty, status: result.status, message: '岗位更新成功' };
      }
      case 'delete_position': {
        const position = await ctx.positionRepository.findOne({ where: { id: args.id } });
        if (!position) return { error: '岗位不存在' };
        await ctx.positionRepository.remove(position);
        return { id: args.id, message: '岗位删除成功' };
      }
      case 'get_position_detail': {
        const position = await ctx.positionRepository.findOne({
          where: { id: args.id },
          relations: ['project', 'candidatePositions', 'candidatePositions.candidate'],
        });
        if (!position) return { error: '岗位不存在' };
        return {
          id: position.id, systemName: position.systemName, department: position.department,
          positionDuty: position.positionDuty, positionType: position.positionType,
          techDomain: position.techDomain, majorType: position.majorType,
          levelDistribution: position.levelDistribution, salaryRange: position.salaryRange,
          requirements: position.requirements, responsibilities: position.responsibilities,
          domainExperience: position.domainExperience, region: position.region,
          deliveryForm: position.deliveryForm, urgency: position.urgency,
          requiredCount: position.requiredCount, hiredCount: position.hiredCount,
          status: position.status,
          project: position.project ? { id: position.project.id, name: position.project.name } : null,
          candidates: position.candidatePositions?.map(cp => ({
            candidateId: cp.candidateId, candidateName: cp.candidate?.name,
            matchScore: cp.matchScore, status: cp.status,
          })) || [],
        };
      }
      case 'import_positions_from_data': {
        const items: any[] = args.items || [];
        const projectId = args.projectId;
        if (!projectId) return { error: '请指定所属项目ID' };
        if (items.length === 0) return { error: '没有可导入的数据' };

        const fieldAliases: Record<string, string> = {
          '系统': 'systemName', '系统名称': 'systemName', '系统名': 'systemName',
          '部门': 'department', '部门名称': 'department',
          '需求编号': 'requirementNumber', '编号': 'requirementNumber',
          '岗位类型': 'positionType', '职位类型': 'positionType', '类型': 'positionType',
          '岗位职务': 'positionDuty', '岗位': 'positionDuty', '职位': 'positionDuty', '岗位名称': 'positionDuty', '职位名称': 'positionDuty', '职务': 'positionDuty',
          '技术领域': 'techDomain', '技术方向': 'techDomain',
          '专业类型': 'majorType', '专业': 'majorType',
          '职级分布': 'levelDistribution', '职级': 'levelDistribution', '级别': 'levelDistribution',
          '薪资范围': 'salaryRange', '薪资': 'salaryRange', '薪酬': 'salaryRange', '工资': 'salaryRange',
          '岗位要求': 'requirements', '任职要求': 'requirements', '要求': 'requirements', '任职资格': 'requirements',
          '岗位职责': 'responsibilities', '职责': 'responsibilities', '工作职责': 'responsibilities', '工作内容': 'responsibilities',
          '领域经验': 'domainExperience', '经验要求': 'domainExperience', '经验': 'domainExperience',
          '地区': 'region', '工作地点': 'region', '地点': 'region', '城市': 'region',
          '交付形式': 'deliveryForm', '交付方式': 'deliveryForm',
          '岗位实施': 'positionImplementation', '实施': 'positionImplementation',
          '紧急程度': 'urgency', '紧急度': 'urgency', '优先级': 'urgency',
          '需求人数': 'requiredCount', '人数': 'requiredCount', '招聘人数': 'requiredCount', 'headcount': 'requiredCount',
          '期望到岗日期': 'expectedDate', '到岗日期': 'expectedDate', '期望日期': 'expectedDate',
        };

        const standardFields = new Set([
          'systemName', 'department', 'requirementNumber', 'positionType', 'positionDuty',
          'techDomain', 'majorType', 'levelDistribution', 'salaryRange', 'requirements',
          'responsibilities', 'domainExperience', 'region', 'deliveryForm', 'positionImplementation',
          'urgency', 'requiredCount', 'expectedDate', 'projectId', 'status',
        ]);

        let successCount = 0;
        let updatedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < items.length; i++) {
          try {
            const rawItem = items[i];
            const mappedItem: Record<string, any> = {};
            for (const [key, value] of Object.entries(rawItem)) {
              if (value === null || value === undefined || value === '') continue;
              const trimmedKey = key.trim();
              if (standardFields.has(trimmedKey)) {
                mappedItem[trimmedKey] = value;
              } else if (fieldAliases[trimmedKey]) {
                mappedItem[fieldAliases[trimmedKey]] = value;
              } else {
                const normalizedKey = trimmedKey.replace(/[\s_\-]/g, '').toLowerCase();
                let matched = false;
                for (const [alias, field] of Object.entries(fieldAliases)) {
                  if (alias.replace(/[\s_\-]/g, '').toLowerCase() === normalizedKey) {
                    mappedItem[field] = value;
                    matched = true;
                    break;
                  }
                }
                if (!matched) {
                  for (const sf of standardFields) {
                    if (sf.replace(/[\s_\-]/g, '').toLowerCase() === normalizedKey) {
                      mappedItem[sf] = value;
                      matched = true;
                      break;
                    }
                  }
                }
                if (!matched) {
                  mappedItem[trimmedKey] = value;
                }
              }
            }

            if (mappedItem.urgency) {
              const urgencyMap: Record<string, string> = {
                '低': 'low', '中': 'medium', '高': 'high', '紧急': 'critical',
                '低优先': 'low', '中优先': 'medium', '高优先': 'high',
              };
              if (urgencyMap[mappedItem.urgency]) mappedItem.urgency = urgencyMap[mappedItem.urgency];
            }

            if (mappedItem.requiredCount && typeof mappedItem.requiredCount === 'string') {
              const parsed = parseInt(mappedItem.requiredCount, 10);
              if (!isNaN(parsed)) mappedItem.requiredCount = parsed;
            }

            if (mappedItem.requirementNumber && projectId) {
              const existing = await ctx.positionRepository.findOne({
                where: { requirementNumber: mappedItem.requirementNumber, projectId },
              });
              if (existing) {
                Object.assign(existing, mappedItem);
                await ctx.positionRepository.save(existing);
                updatedCount++;
                successCount++;
                continue;
              }
            }

            const position = ctx.positionRepository.create({
              systemName: mappedItem.systemName || '未指定',
              department: mappedItem.department || '未指定',
              positionDuty: mappedItem.positionDuty || '未指定',
              positionType: mappedItem.positionType || '未指定',
              techDomain: mappedItem.techDomain || '未指定',
              majorType: mappedItem.majorType || '未指定',
              levelDistribution: mappedItem.levelDistribution || '未指定',
              salaryRange: mappedItem.salaryRange || null,
              requirements: mappedItem.requirements || '待补充',
              responsibilities: mappedItem.responsibilities || '待补充',
              domainExperience: mappedItem.domainExperience || '待补充',
              region: mappedItem.region || '未指定',
              deliveryForm: mappedItem.deliveryForm || '未指定',
              positionImplementation: mappedItem.positionImplementation || '',
              urgency: mappedItem.urgency || 'medium',
              requiredCount: mappedItem.requiredCount || 1,
              expectedDate: convertExcelDate(mappedItem.expectedDate) as any,
              requirementNumber: mappedItem.requirementNumber || `REQ-${Date.now()}-${i}`,
              projectId,
              creatorId: ctx.userId,
            });
            await ctx.positionRepository.save(position);
            successCount++;
          } catch (err: any) {
            errors.push(`第${i + 1}条导入失败: ${err.message || '未知错误'}`);
          }
        }
        const updatedMsg = updatedCount > 0 ? `，其中 ${updatedCount} 条为覆盖更新` : '';
        return { successCount, updatedCount, totalItems: items.length, errors, message: `成功导入${successCount}条岗位数据${updatedMsg}` };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
