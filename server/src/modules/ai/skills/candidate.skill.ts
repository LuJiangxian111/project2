import { ISkill, SkillContext } from './skill-registry';

function convertExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) return str.replace(/\//g, '-').substring(0, 10);
  const num = Number(str);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + num * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return null;
}

export class CandidateSkill implements ISkill {
  name = 'candidate';
  description = '候选人管理：添加、查看、更新、删除候选人，搜索候选人，批量导入候选人数据';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'list_candidates',
        description: '获取候选人列表，返回包含姓名、学历、领域年限等完整信息',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_candidates',
        description: '按姓名、手机号、邮箱等关键词搜索候选人',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '姓名关键词' },
            phone: { type: 'string', description: '手机号' },
            email: { type: 'string', description: '邮箱' },
            supplier: { type: 'string', description: '供应商关键词' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'create_candidate',
        description: '添加新候选人',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '姓名' },
            gender: { type: 'string', description: '性别' },
            phone: { type: 'string', description: '联系电话' },
            email: { type: 'string', description: '邮箱' },
            education: { type: 'string', description: '学历' },
            domainYears: { type: 'string', description: '领域年限' },
            workStatus: { type: 'string', description: '工作状态' },
            expectedSalary: { type: 'string', description: '期望薪资' },
            supplier: { type: 'string', description: '供应商' },
          },
          required: ['name'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'update_candidate',
        description: '更新候选人信息',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'number', description: '候选人ID' },
            name: { type: 'string', description: '姓名' },
            gender: { type: 'string', description: '性别' },
            phone: { type: 'string', description: '联系电话' },
            email: { type: 'string', description: '邮箱' },
            education: { type: 'string', description: '学历' },
            domainYears: { type: 'string', description: '领域年限' },
            workStatus: { type: 'string', description: '工作状态' },
            expectedSalary: { type: 'string', description: '期望薪资' },
            supplier: { type: 'string', description: '供应商' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'delete_candidate',
        description: '删除候选人',
        parameters: {
          type: 'object',
          properties: { id: { type: 'number', description: '候选人ID' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_candidate_detail',
        description: '获取候选人详细信息',
        parameters: {
          type: 'object',
          properties: { id: { type: 'number', description: '候选人ID' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'import_candidates_from_data',
        description: '智能批量导入候选人数据。系统会自动进行字段映射，将Excel列名匹配到系统标准字段（如"姓名"→name, "手机"→contactPhone, "邮箱"→contactEmail等）。传入原始数据即可，无需手动映射字段名。',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: '候选人数据数组，每条记录是一个对象，键名可以是Excel原始列名或系统标准字段名，系统会自动映射',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '姓名' },
                  gender: { type: 'string', description: '性别' },
                  idType: { type: 'string', description: '证件类型' },
                  idNumber: { type: 'string', description: '证件号码' },
                  contactPhone: { type: 'string', description: '联系电话' },
                  contactEmail: { type: 'string', description: '联系邮箱' },
                  areaCode: { type: 'string', description: '区号' },
                  educationType: { type: 'string', description: '学历类型' },
                  education: { type: 'string', description: '学历' },
                  domainYears: { type: 'string', description: '领域年限' },
                  workStatus: { type: 'string', description: '工作状态' },
                  expectedSalary: { type: 'string', description: '期望薪资' },
                  supplier: { type: 'string', description: '供应商' },
                  recommender: { type: 'string', description: '推荐人' },
                  recommendReason: { type: 'string', description: '推荐理由' },
                },
              },
            },
          },
          required: ['items'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'list_candidates': {
        const candidates = await ctx.candidateRepository.find({ order: { createdAt: 'DESC' } });
        return candidates.map(c => ({
          id: c.id, name: c.name, gender: c.gender, education: c.education,
          domainYears: c.domainYears, workStatus: c.workStatus, expectedSalary: c.expectedSalary,
          supplier: c.supplier, contactPhone: c.contactPhone, contactEmail: c.contactEmail,
          educationType: c.educationType,
        }));
      }
      case 'search_candidates': {
        const qb = ctx.candidateRepository.createQueryBuilder('c');
        if (args.name) qb.andWhere('c.name LIKE :name', { name: `%${args.name}%` });
        if (args.phone) qb.andWhere('c.contact_phone LIKE :phone', { phone: `%${args.phone}%` });
        if (args.email) qb.andWhere('c.contact_email LIKE :email', { email: `%${args.email}%` });
        if (args.supplier) qb.andWhere('c.supplier LIKE :supplier', { supplier: `%${args.supplier}%` });
        qb.orderBy('c.created_at', 'DESC').limit(50);
        const candidates = await qb.getMany();
        return candidates.map(c => ({
          id: c.id, name: c.name, gender: c.gender, education: c.education,
          domainYears: c.domainYears, workStatus: c.workStatus, expectedSalary: c.expectedSalary,
          supplier: c.supplier, contactPhone: c.contactPhone, contactEmail: c.contactEmail,
        }));
      }
      case 'create_candidate': {
        const candidate = ctx.candidateRepository.create({
          name: args.name,
          gender: args.gender || '未提供',
          contactPhone: args.phone || '',
          contactEmail: args.email || '',
          education: args.education || '未提供',
          domainYears: args.domainYears ? Number(args.domainYears) : null,
          workStatus: args.workStatus || '未提供',
          expectedSalary: args.expectedSalary || '未提供',
          supplier: args.supplier || '未提供',
          idType: '身份证',
          educationType: '统招',
        });
        const result = await ctx.candidateRepository.save(candidate);
        return { id: result.id, name: result.name, message: '候选人添加成功' };
      }
      case 'update_candidate': {
        const candidate = await ctx.candidateRepository.findOne({ where: { id: args.id } });
        if (!candidate) return { error: '候选人不存在' };
        if (args.name !== undefined) candidate.name = args.name;
        if (args.gender !== undefined) candidate.gender = args.gender;
        if (args.phone !== undefined) candidate.contactPhone = args.phone;
        if (args.email !== undefined) candidate.contactEmail = args.email;
        if (args.education !== undefined) candidate.education = args.education;
        if (args.domainYears !== undefined) candidate.domainYears = Number(args.domainYears);
        if (args.workStatus !== undefined) candidate.workStatus = args.workStatus;
        if (args.expectedSalary !== undefined) candidate.expectedSalary = args.expectedSalary;
        if (args.supplier !== undefined) candidate.supplier = args.supplier;
        const result = await ctx.candidateRepository.save(candidate);
        return { id: result.id, name: result.name, message: '候选人更新成功' };
      }
      case 'delete_candidate': {
        const candidate = await ctx.candidateRepository.findOne({ where: { id: args.id } });
        if (!candidate) return { error: '候选人不存在' };
        await ctx.candidateRepository.remove(candidate);
        return { id: args.id, message: '候选人删除成功' };
      }
      case 'get_candidate_detail': {
        const candidate = await ctx.candidateRepository.findOne({
          where: { id: args.id },
          relations: ['candidatePositions', 'candidatePositions.position'],
        });
        if (!candidate) return { error: '候选人不存在' };
        return {
          id: candidate.id, name: candidate.name, gender: candidate.gender,
          idType: candidate.idType, idNumber: candidate.idNumber,
          contactPhone: candidate.contactPhone, contactEmail: candidate.contactEmail,
          educationType: candidate.educationType, education: candidate.education,
          domainYears: candidate.domainYears, workStatus: candidate.workStatus,
          expectedSalary: candidate.expectedSalary, supplier: candidate.supplier,
          resumeText: candidate.resumeText,
          positions: candidate.candidatePositions?.map(cp => ({
            positionId: cp.positionId, positionDuty: cp.position?.positionDuty,
            matchScore: cp.matchScore, status: cp.status,
          })) || [],
        };
      }
      case 'import_candidates_from_data': {
        const items: any[] = args.items || [];
        let successCount = 0;
        const errors: string[] = [];

        const fieldAliases: Record<string, string> = {
          '姓名': 'name', '名字': 'name', '候选人': 'name',
          '性别': 'gender',
          '证件类型': 'idType', '证件种类': 'idType',
          '证件号码': 'idNumber', '身份证号': 'idNumber', '身份证': 'idNumber',
          '联系电话': 'contactPhone', '电话': 'contactPhone', '手机': 'contactPhone', '手机号': 'contactPhone', '联系方式': 'contactPhone',
          '联系邮箱': 'contactEmail', '邮箱': 'contactEmail', 'email': 'contactEmail', '电子邮件': 'contactEmail',
          '区号': 'areaCode',
          '学历类型': 'educationType', '学历性质': 'educationType',
          '学历': 'education', '最高学历': 'education', '学位': 'education',
          '领域年限': 'domainYears', '工作年限': 'domainYears', '经验年限': 'domainYears', '年限': 'domainYears',
          '工作状态': 'workStatus', '在职状态': 'workStatus', '状态': 'workStatus',
          '期望薪资': 'expectedSalary', '薪资': 'expectedSalary', '期望工资': 'expectedSalary',
          '供应商': 'supplier', '推荐公司': 'supplier', '公司': 'supplier',
          '推荐人': 'recommender', '推荐者': 'recommender',
          '推荐理由': 'recommendReason', '推荐原因': 'recommendReason',
        };

        const standardFields = new Set([
          'name', 'gender', 'idType', 'idNumber', 'contactPhone', 'contactEmail',
          'areaCode', 'educationType', 'education', 'domainYears', 'workStatus',
          'expectedSalary', 'supplier', 'recommender', 'recommendReason',
        ]);

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
                if (!matched) mappedItem[trimmedKey] = value;
              }
            }

            const candidate = ctx.candidateRepository.create({
              name: mappedItem.name || '未命名',
              gender: mappedItem.gender || '未提供',
              idType: mappedItem.idType || '身份证',
              idNumber: mappedItem.idNumber || '',
              contactPhone: mappedItem.contactPhone || '',
              contactEmail: mappedItem.contactEmail || '',
              educationType: mappedItem.educationType || '统招',
              education: mappedItem.education || '未提供',
              domainYears: mappedItem.domainYears ? Number(mappedItem.domainYears) : null,
              workStatus: mappedItem.workStatus || '未提供',
              expectedSalary: mappedItem.expectedSalary || '未提供',
              supplier: mappedItem.supplier || '未提供',
              graduationDate: convertExcelDate(mappedItem.graduationDate) as any,
            });
            await ctx.candidateRepository.save(candidate);
            successCount++;
          } catch (err: any) {
            errors.push(`第${i + 1}条导入失败: ${err.message || '未知错误'}`);
          }
        }
        return { successCount, totalItems: items.length, errors, message: `成功导入${successCount}条候选人数据` };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
