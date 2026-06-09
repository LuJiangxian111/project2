import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Position } from '../../entities/position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Project } from '../../entities/project.entity';
import { CandidatePosition } from '../../entities/candidate-position.entity';
import { Interview } from '../../entities/interview.entity';
import { LogService } from '../log/log.service';
import OpenAI from 'openai';

const DEFAULT_LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_LLM_API_KEY = process.env.LLM_API_KEY || '';
const DEFAULT_LLM_MODEL = process.env.LLM_MODEL || 'gpt-3.5-turbo';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Candidate)
    private candidateRepository: Repository<Candidate>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(CandidatePosition)
    private candidatePositionRepository: Repository<CandidatePosition>,
    @InjectRepository(Interview)
    private interviewRepository: Repository<Interview>,
    private logService: LogService,
  ) {}

  private async getClient(userId: number): Promise<{
    client: OpenAI;
    model: string;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const apiKey = user?.llmApiKey || DEFAULT_LLM_API_KEY;
    const baseURL = user?.llmBaseUrl || DEFAULT_LLM_BASE_URL;
    const model = user?.llmModel || DEFAULT_LLM_MODEL;

    const client = new OpenAI({
      apiKey,
      baseURL,
    });

    return { client, model };
  }

  async chat(
    messages: { role: string; content: string }[],
    userId: number,
  ) {
    const { client, model } = await this.getClient(userId);

    const response = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: 0.7,
    });

    await this.logService.log(userId, 'ai_chat', 'ai', null, {
      model,
      messageCount: messages.length,
    });

    return {
      content: response.choices[0]?.message?.content,
      model: response.model,
      usage: response.usage,
    };
  }

  async parseResume(fileContent: string, userId: number) {
    const { client, model } = await this.getClient(userId);

    const prompt = `请解析以下简历内容，提取结构化信息，以JSON格式返回，包含以下字段：
- name: 姓名
- phone: 电话
- email: 邮箱
- yearsOfExperience: 工作年限
- currentCompany: 当前公司
- skills: 技能列表(数组)
- education: 学历
- summary: 简历摘要

简历内容：
${fileContent}`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';

    await this.logService.log(userId, 'parse_resume', 'ai', null, {
      model,
    });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return { rawContent: content };
    }
  }

  async matchCandidate(
    candidate: Candidate,
    position: Position,
    userId: number,
  ): Promise<{ score: number; detail: any }> {
    const { client, model } = await this.getClient(userId);

    const candidateInfo = `
姓名: ${candidate.name}
性别: ${candidate.gender || '未提供'}
学历类型: ${candidate.educationType || '未提供'}
学历: ${candidate.education || '未提供'}
领域年限: ${candidate.domainYears || '未提供'}
工作状态: ${candidate.workStatus || '未提供'}
期望薪资: ${candidate.expectedSalary || '未提供'}
供应商: ${candidate.supplier || '未提供'}
简历摘要: ${candidate.resumeText || '未提供'}`;

    const positionInfo = `
岗位职务: ${position.positionDuty}
系统: ${position.systemName}
部门: ${position.department}
岗位类型: ${position.positionType}
技术领域: ${position.techDomain}
专业类型: ${position.majorType}
职级分布: ${position.levelDistribution}
任职要求: ${position.requirements}
岗位职责: ${position.responsibilities}
领域经验: ${position.domainExperience}
薪资范围: ${position.salaryRange || '面议'}
地区: ${position.region}
交付形式: ${position.deliveryForm}
紧急程度: ${position.urgency}`;

    const prompt = `请分析以下候选人与岗位的匹配度，返回JSON格式：
{
  "score": 匹配分数(0-100的整数),
  "detail": {
    "skillMatch": 技能匹配分析,
    "experienceMatch": 经验匹配分析,
    "educationMatch": 学历匹配分析,
    "overallAnalysis": 综合分析,
    "strengths": ["优势1", "优势2"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": "建议"
  }
}

候选人信息：
${candidateInfo}

岗位信息：
${positionInfo}`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';

    await this.logService.log(userId, 'match_candidate', 'ai', null, {
      candidateId: candidate.id,
      positionId: position.id,
      model,
    });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      return {
        score: parsed.score || 0,
        detail: parsed.detail || {},
      };
    } catch {
      return {
        score: 0,
        detail: { rawContent: content },
      };
    }
  }

  async generateInterviewQuestions(
    candidate: Candidate,
    position: Position,
    round: number,
    userId: number,
  ) {
    const { client, model } = await this.getClient(userId);

    const prompt = `请为以下候选人的第${round}轮面试生成面试问题，返回JSON数组格式：
[
  {
    "category": "问题分类(技术/项目/行为/综合)",
    "question": "面试问题",
    "purpose": "考察目的",
    "expectedPoints": ["期望回答要点1", "期望回答要点2"]
  }
]

候选人信息：
- 姓名: ${candidate.name}
- 性别: ${candidate.gender || '未提供'}
- 学历: ${candidate.education || '未提供'}
- 领域年限: ${candidate.domainYears || '未提供'}
- 工作状态: ${candidate.workStatus || '未提供'}
- 期望薪资: ${candidate.expectedSalary || '未提供'}

岗位信息：
- 岗位职务: ${position.positionDuty}
- 岗位类型: ${position.positionType}
- 技术领域: ${position.techDomain}
- 任职要求: ${position.requirements}
- 岗位职责: ${position.responsibilities}
- 领域经验: ${position.domainExperience}

请生成5-8个面试问题，涵盖技术能力、项目经验、团队协作等方面。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content || '[]';

    await this.logService.log(
      userId,
      'generate_interview_questions',
      'ai',
      null,
      { candidateId: candidate.id, positionId: position.id, round, model },
    );

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return [{ category: '综合', question: content, purpose: 'AI生成', expectedPoints: [] }];
    }
  }

  async generateReport(
    type: string,
    params: any,
    userId: number,
  ) {
    const { client, model } = await this.getClient(userId);

    let prompt = '';

    if (type === 'position') {
      const position = await this.positionRepository.findOne({
        where: { id: params.positionId },
        relations: ['project', 'candidatePositions', 'candidatePositions.candidate'],
      });
      if (!position) throw new Error('岗位不存在');

      prompt = `请为以下岗位生成招聘分析报告：

岗位：${position.positionDuty}
项目：${position.project?.name}
需求人数：${position.requiredCount}
已录用人数：${position.hiredCount}
紧急程度：${position.urgency}
状态：${position.status}

候选人情况：
${position.candidatePositions?.map((cp) => `- ${cp.candidate?.name}: 匹配度${cp.matchScore}, 状态${cp.status}`).join('\n') || '暂无候选人'}

请从以下方面分析：
1. 招聘进度分析
2. 候选人质量评估
3. 招聘风险提示
4. 改进建议`;
    } else if (type === 'project') {
      const project = await this.projectRepository.findOne({
        where: { id: params.projectId },
        relations: ['positions', 'positions.candidatePositions'],
      });
      if (!project) throw new Error('项目不存在');

      prompt = `请为以下项目生成人力需求分析报告：

项目：${project.name}
状态：${project.status}
描述：${project.description}

岗位需求：
${project.positions?.map((p) => `- ${p.positionDuty}: 需${p.requiredCount}人/已录用${p.hiredCount}人, 紧急度${p.urgency}, 状态${p.status}`).join('\n') || '暂无岗位'}

请从以下方面分析：
1. 人力需求满足度
2. 招聘进度风险
3. 关键岗位缺口
4. 建议措施`;
    } else {
      prompt = params.prompt || '请生成报告';
    }

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content || '';

    await this.logService.log(userId, 'generate_report', 'ai', null, {
      type,
      model,
    });

    return { content, type };
  }

  async analyzeRisk(params: any, userId: number) {
    const { client, model } = await this.getClient(userId);

    const positions = await this.positionRepository.find({
      where: { status: 'open' },
      relations: ['project'],
    });

    const criticalPositions = positions.filter(
      (p) => p.urgency === 'critical' || p.urgency === 'high',
    );

    const prompt = `请分析以下岗位需求的风险情况，返回JSON格式：
{
  "overallRisk": "高/中/低",
  "riskItems": [
    {
      "type": "风险类型",
      "level": "高/中/低",
      "description": "风险描述",
      "suggestion": "建议措施"
    }
  ],
  "summary": "总体风险概述"
}

当前开放岗位数: ${positions.length}
高紧急度岗位数: ${criticalPositions.length}

岗位详情：
${positions
  .map(
    (p) =>
      `- ${p.positionDuty}(${p.project?.name || '未知项目'}): 需${p.requiredCount}人/已录用${p.hiredCount}人, 紧急度${p.urgency}, 期望到岗${p.expectedDate}`,
  )
  .join('\n')}`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';

    await this.logService.log(userId, 'analyze_risk', 'ai', null, { model });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return { rawContent: content };
    }
  }

  async analyzeFileForImport(fileContent: string, fileName: string, instruction: string, userId: number) {
    const { client, model } = await this.getClient(userId);

    const prompt = `分析文件样本，识别是"岗位需求"还是"候选人推荐"，建立字段映射。

岗位字段：systemName(系统), department(部门), requirementNumber(需求编号), positionType(岗位类型), positionDuty(岗位职务), techDomain(技术领域), majorType(专业类型), levelDistribution(职级分布), salaryRange(薪资范围), requirements(岗位要求), responsibilities(岗位职责), domainExperience(领域经验), region(地区), deliveryForm(交付形式), positionImplementation(岗位实施), urgency(紧急程度low/medium/high/critical), requiredCount(需求人数), expectedDate(期望到岗日期)

候选人字段：name(姓名), gender(性别), idType(证件类型), idNumber(证件号码), contactPhone(联系电话), contactEmail(联系邮箱), areaCode(区号), supplier(供应商), educationType(学历类型), education(学历), graduationDate(毕业时间), domainYears(领域年限), workStatus(工作状态), expectedSalary(期望薪资), recommender(推荐人), recommendReason(推荐理由)

候选人文件中的岗位关联字段（必须映射）：systemName, department, requirementNumber, positionType, positionDuty, techDomain, majorType, levelDistribution, salaryRange, region, deliveryForm

返回JSON：{"type":"position或candidate","fieldMapping":{"文件列名":"系统字段名"},"unmappedFields":{"无法映射列":"示例值"},"summary":"摘要"}

注意：语义匹配！"岗位/职位"→positionDuty, "岗位类型"→positionType, "手机/电话"→contactPhone, "邮箱"→contactEmail, "身份证号"→idNumber, "工作年限"→domainYears, "供应商/公司"→supplier。候选人文件必须映射所有岗位相关列。

${instruction ? `用户指令：${instruction}\n\n` : ''}文件名：${fileName}

文件样本数据：
${fileContent}`;

    console.log(`[AI] analyzeFileForImport: fileName=${fileName}, contentLen=${fileContent.length}, model=${model}`);

    let response;
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[AI] analyzeFileForImport attempt ${attempt}/3`);
        response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }, { timeout: 120000 });
        break; // 成功则跳出
      } catch (apiErr: any) {
        lastErr = apiErr;
        console.error(`[AI] analyzeFileForImport attempt ${attempt} error:`, apiErr?.message || apiErr);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt)); // 递增等待
        }
      }
    }
    if (!response) {
      console.error('[AI] analyzeFileForImport all attempts failed');
      throw lastErr;
    }

    const content = response.choices[0]?.message?.content || '{}';
    console.log(`[AI] analyzeFileForImport response length: ${content.length}, preview: ${content.substring(0, 200)}`);

    await this.logService.log(userId, 'analyze_file_for_import', 'ai', null, {
      model,
      fileName,
    });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return { type: 'unknown', items: [], rawContent: content, summary: '解析失败' };
    }
  }

  async chatWithFile(
    messages: { role: string; content: string }[],
    fileContent: string,
    fileName: string,
    userId: number,
  ) {
    const { client, model } = await this.getClient(userId);

    // 截断过长的文件内容
    const truncatedContent = fileContent.length > 30000
      ? fileContent.substring(0, 30000) + '\n\n... (文件内容过长，已截断)'
      : fileContent;

    // 将文件内容注入到用户消息中
    const enrichedMessages = messages.map((msg) => {
      if (msg.role === 'user' && msg.content) {
        return {
          ...msg,
          content: `用户上传了文件"${fileName}"，文件内容如下：\n${truncatedContent}\n\n用户消息：${msg.content}`,
        };
      }
      return msg;
    });

    // 如果没有用户消息，只有文件
    const hasUserMsg = messages.some((m) => m.role === 'user' && m.content.trim());
    const finalMessages = hasUserMsg
      ? enrichedMessages
      : [
          {
            role: 'user' as const,
            content: `用户上传了文件"${fileName}"，文件内容如下：\n${truncatedContent}\n\n请分析这个文件的内容，提取关键信息并给出你的见解。`,
          },
        ];

    const response = await client.chat.completions.create({
      model,
      messages: finalMessages as any,
      temperature: 0.5,
    }, { timeout: 120000 });

    await this.logService.log(userId, 'ai_chat_with_file', 'ai', null, {
      model,
      fileName,
      messageCount: messages.length,
    });

    return {
      content: response.choices[0]?.message?.content,
      model: response.model,
      usage: response.usage,
    };
  }

  async agentChat(messages: { role: string; content: string }[], userId: number) {
    const { client, model } = await this.getClient(userId);

    const tools = [
      // ===== Project tools =====
      {
        type: 'function' as const,
        function: {
          name: 'list_projects',
          description: '获取项目列表',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'create_project',
          description: '创建新项目',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '项目名称' },
              description: { type: 'string', description: '项目描述' },
              status: { type: 'string', enum: ['planning', 'active', 'completed', 'paused'], description: '项目状态' },
            },
            required: ['name'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'update_project',
          description: '更新项目信息',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: '项目ID' },
              name: { type: 'string', description: '项目名称' },
              description: { type: 'string', description: '项目描述' },
              status: { type: 'string', enum: ['planning', 'active', 'completed', 'paused'], description: '项目状态' },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'delete_project',
          description: '删除项目',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'number', description: '项目ID' },
            },
            required: ['id'],
          },
        },
      },
      // ===== Position tools =====
      {
        type: 'function' as const,
        function: {
          name: 'list_positions',
          description: '获取岗位列表，可按项目ID筛选。返回包含需求编号、岗位职务、部门等完整信息。',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'number', description: '项目ID（可选）' },
            },
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
            properties: {
              id: { type: 'number', description: '岗位ID' },
            },
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
            properties: {
              id: { type: 'number', description: '岗位ID' },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'import_positions_from_data',
          description: '批量导入岗位数据',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'number', description: '所属项目ID' },
              items: {
                type: 'array',
                description: '岗位数据数组',
                items: {
                  type: 'object',
                  properties: {
                    systemName: { type: 'string', description: '系统名称' },
                    department: { type: 'string', description: '部门' },
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
                    urgency: { type: 'string', description: '紧急程度' },
                    requiredCount: { type: 'number', description: '需求人数' },
                  },
                },
              },
            },
            required: ['projectId', 'items'],
          },
        },
      },
      // ===== Candidate tools =====
      {
        type: 'function' as const,
        function: {
          name: 'list_candidates',
          description: '获取候选人列表，返回包含姓名、学历、领域年限等完整信息',
          parameters: {
            type: 'object',
            properties: {},
          },
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
            properties: {
              id: { type: 'number', description: '候选人ID' },
            },
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
            properties: {
              id: { type: 'number', description: '候选人ID' },
            },
            required: ['id'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'import_candidates_from_data',
          description: '批量导入候选人数据',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                description: '候选人数据数组',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '姓名' },
                    gender: { type: 'string', description: '性别' },
                    idType: { type: 'string', description: '证件类型' },
                    idNumber: { type: 'string', description: '证件号码' },
                    contactPhone: { type: 'string', description: '联系电话' },
                    contactEmail: { type: 'string', description: '联系邮箱' },
                    educationType: { type: 'string', description: '学历类型' },
                    education: { type: 'string', description: '学历' },
                    domainYears: { type: 'string', description: '领域年限' },
                    workStatus: { type: 'string', description: '工作状态' },
                    expectedSalary: { type: 'string', description: '期望薪资' },
                    supplier: { type: 'string', description: '供应商' },
                  },
                },
              },
            },
            required: ['items'],
          },
        },
      },
      // ===== Assignment/Matching tools =====
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
          description: '获取岗位的候选人列表',
          parameters: {
            type: 'object',
            properties: {
              positionId: { type: 'number', description: '岗位ID' },
            },
            required: ['positionId'],
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
      // ===== Interview tools =====
      {
        type: 'function' as const,
        function: {
          name: 'list_interviews',
          description: '获取面试列表',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'create_interview',
          description: '创建面试安排',
          parameters: {
            type: 'object',
            properties: {
              candidateId: { type: 'number', description: '候选人ID' },
              positionId: { type: 'number', description: '岗位ID' },
              interviewDate: { type: 'string', description: '面试日期时间，如2024-01-15T10:00:00' },
              round: { type: 'number', description: '面试轮次' },
              interviewerId: { type: 'number', description: '面试官用户ID' },
            },
            required: ['candidateId', 'positionId', 'interviewDate', 'round'],
          },
        },
      },
      // ===== Export tools =====
      {
        type: 'function' as const,
        function: {
          name: 'export_positions_csv',
          description: '导出岗位数据为CSV格式',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'number', description: '项目ID（可选，筛选指定项目的岗位）' },
            },
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
              positionId: { type: 'number', description: '岗位ID（可选，筛选指定岗位的候选人）' },
            },
          },
        },
      },
      // ===== Dashboard/Stats tools =====
      {
        type: 'function' as const,
        function: {
          name: 'get_dashboard_stats',
          description: '获取仪表盘统计数据，包括项目数、岗位数、候选人数等',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      // ===== AI tools =====
      {
        type: 'function' as const,
        function: {
          name: 'analyze_risk',
          description: '分析招聘风险',
          parameters: {
            type: 'object',
            properties: {},
          },
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

    const systemMessage = {
      role: 'system' as const,
      content: `你是一个智能招聘管理助手，可以完全控制和管理整个招聘平台。你可以执行以下操作：

项目管理：创建、查看、更新、删除项目
岗位管理：创建、查看、更新、删除岗位，按需求编号/岗位名称搜索岗位，批量导入岗位数据，导出岗位数据为CSV
候选人管理：添加、查看、更新、删除候选人，按姓名/手机号搜索候选人，批量导入候选人数据，导出候选人数据为CSV
分配管理：将候选人分配到岗位，查看岗位的候选人列表
面试管理：创建面试安排，查看面试列表
AI分析：候选人匹配分析、风险分析、生成报告
数据统计：查看仪表盘统计数据

重要规则：
1. 当用户提供需求编号（如R2508209923）时，必须使用search_positions工具按requirementNumber搜索，不要用list_positions
2. 当用户提供候选人姓名时，使用search_candidates工具搜索
3. 当用户上传文件要求导入时，先理解文件内容，然后调用相应的导入工具。如果用户指定了目标岗位，先用search_positions找到岗位ID，再导入
4. 当用户要求导出数据时，调用导出工具生成CSV格式数据，用\`\`\`csv和\`\`\`包裹CSV内容
5. 操作完成后，用中文向用户汇报结果。如果参数不完整，请主动询问`,
    };

    const allMessages = [systemMessage, ...messages] as any[];

    let response = await client.chat.completions.create({
      model,
      messages: allMessages,
      tools,
      tool_choice: 'auto',
      temperature: 0.5,
    });

    let assistantMessage = response.choices[0]?.message;
    let finalContent = assistantMessage?.content || '';

    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      allMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        let functionResult: any;

        try {
          const args = JSON.parse(toolCall.function.arguments);
          functionResult = await this.executeToolCall(functionName, args, userId);
        } catch (err: any) {
          functionResult = { error: err.message || '执行失败' };
        }

        allMessages.push({
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResult),
        });
      }

      response = await client.chat.completions.create({
        model,
        messages: allMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.5,
      });

      assistantMessage = response.choices[0]?.message;
      if (assistantMessage?.content) {
        finalContent = assistantMessage.content;
      }
    }

    await this.logService.log(userId, 'agent_chat', 'ai', null, {
      model,
      messageCount: messages.length,
    });

    return {
      content: finalContent,
      model: response.model,
      usage: response.usage,
    };
  }

  private async executeToolCall(functionName: string, args: any, userId: number): Promise<any> {
    switch (functionName) {
      // ===== Project tools =====
      case 'list_projects': {
        const projects = await this.projectRepository.find({ order: { createdAt: 'DESC' } });
        return projects.map(p => ({ id: p.id, name: p.name, status: p.status, description: p.description }));
      }
      case 'create_project': {
        const project = this.projectRepository.create({
          name: args.name,
          description: args.description || '',
          status: args.status || 'planning',
          managerId: userId,
        });
        const result = await this.projectRepository.save(project);
        return { id: result.id, name: result.name, status: result.status, message: '项目创建成功' };
      }
      case 'update_project': {
        const project = await this.projectRepository.findOne({ where: { id: args.id } });
        if (!project) return { error: '项目不存在' };
        if (args.name !== undefined) project.name = args.name;
        if (args.description !== undefined) project.description = args.description;
        if (args.status !== undefined) project.status = args.status;
        const result = await this.projectRepository.save(project);
        return { id: result.id, name: result.name, status: result.status, message: '项目更新成功' };
      }
      case 'delete_project': {
        const project = await this.projectRepository.findOne({ where: { id: args.id } });
        if (!project) return { error: '项目不存在' };
        await this.projectRepository.remove(project);
        return { id: args.id, message: '项目删除成功' };
      }
      // ===== Position tools =====
      case 'list_positions': {
        const where: any = {};
        if (args.projectId) where.projectId = args.projectId;
        const positions = await this.positionRepository.find({ where, order: { createdAt: 'DESC' } });
        return positions.map(p => ({
          id: p.id, requirementNumber: p.requirementNumber, systemName: p.systemName,
          positionDuty: p.positionDuty, department: p.department, urgency: p.urgency,
          status: p.status, requiredCount: p.requiredCount, hiredCount: p.hiredCount,
          region: p.region, positionType: p.positionType, techDomain: p.techDomain,
          salaryRange: p.salaryRange, projectId: p.projectId, deliveryForm: p.deliveryForm,
        }));
      }
      case 'search_positions': {
        const qb = this.positionRepository.createQueryBuilder('p');
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
        const position = this.positionRepository.create({
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
          creatorId: userId,
        });
        const result = await this.positionRepository.save(position);
        return { id: result.id, positionDuty: result.positionDuty, message: '岗位创建成功' };
      }
      case 'update_position': {
        const position = await this.positionRepository.findOne({ where: { id: args.id } });
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
        const result = await this.positionRepository.save(position);
        return { id: result.id, positionDuty: result.positionDuty, status: result.status, message: '岗位更新成功' };
      }
      case 'delete_position': {
        const position = await this.positionRepository.findOne({ where: { id: args.id } });
        if (!position) return { error: '岗位不存在' };
        await this.positionRepository.remove(position);
        return { id: args.id, message: '岗位删除成功' };
      }
      case 'get_position_detail': {
        const position = await this.positionRepository.findOne({
          where: { id: args.id },
          relations: ['project', 'candidatePositions', 'candidatePositions.candidate'],
        });
        if (!position) return { error: '岗位不存在' };
        return {
          id: position.id,
          systemName: position.systemName,
          department: position.department,
          positionDuty: position.positionDuty,
          positionType: position.positionType,
          techDomain: position.techDomain,
          majorType: position.majorType,
          levelDistribution: position.levelDistribution,
          salaryRange: position.salaryRange,
          requirements: position.requirements,
          responsibilities: position.responsibilities,
          domainExperience: position.domainExperience,
          region: position.region,
          deliveryForm: position.deliveryForm,
          urgency: position.urgency,
          requiredCount: position.requiredCount,
          hiredCount: position.hiredCount,
          status: position.status,
          project: position.project ? { id: position.project.id, name: position.project.name } : null,
          candidates: position.candidatePositions?.map(cp => ({
            candidateId: cp.candidateId,
            candidateName: cp.candidate?.name,
            matchScore: cp.matchScore,
            status: cp.status,
          })) || [],
        };
      }
      case 'import_positions_from_data': {
        const items: any[] = args.items || [];
        let successCount = 0;
        const errors: string[] = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const item = items[i];
            const position = this.positionRepository.create({
              systemName: item.systemName || '未指定',
              department: item.department || '未指定',
              positionDuty: item.positionDuty || '未指定',
              positionType: item.positionType || '未指定',
              techDomain: item.techDomain || '未指定',
              majorType: item.majorType || '未指定',
              levelDistribution: item.levelDistribution || '未指定',
              salaryRange: item.salaryRange || null,
              requirements: item.requirements || '待补充',
              responsibilities: item.responsibilities || '待补充',
              domainExperience: item.domainExperience || '待补充',
              region: item.region || '未指定',
              deliveryForm: item.deliveryForm || '未指定',
              urgency: item.urgency || 'medium',
              requiredCount: item.requiredCount || 1,
              requirementNumber: `REQ-${Date.now()}-${i}`,
              projectId: args.projectId,
              creatorId: userId,
            });
            await this.positionRepository.save(position);
            successCount++;
          } catch (err: any) {
            errors.push(`第${i + 1}条导入失败: ${err.message || '未知错误'}`);
          }
        }
        return { successCount, totalItems: items.length, errors, message: `成功导入${successCount}条岗位数据` };
      }
      // ===== Candidate tools =====
      case 'list_candidates': {
        const candidates = await this.candidateRepository.find({ order: { createdAt: 'DESC' } });
        return candidates.map(c => ({
          id: c.id, name: c.name, gender: c.gender, education: c.education,
          domainYears: c.domainYears, workStatus: c.workStatus, expectedSalary: c.expectedSalary,
          supplier: c.supplier, contactPhone: c.contactPhone, contactEmail: c.contactEmail,
          educationType: c.educationType,
        }));
      }
      case 'search_candidates': {
        const qb = this.candidateRepository.createQueryBuilder('c');
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
        const candidate = this.candidateRepository.create({
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
        const result = await this.candidateRepository.save(candidate);
        return { id: result.id, name: result.name, message: '候选人添加成功' };
      }
      case 'update_candidate': {
        const candidate = await this.candidateRepository.findOne({ where: { id: args.id } });
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
        const result = await this.candidateRepository.save(candidate);
        return { id: result.id, name: result.name, message: '候选人更新成功' };
      }
      case 'delete_candidate': {
        const candidate = await this.candidateRepository.findOne({ where: { id: args.id } });
        if (!candidate) return { error: '候选人不存在' };
        await this.candidateRepository.remove(candidate);
        return { id: args.id, message: '候选人删除成功' };
      }
      case 'get_candidate_detail': {
        const candidate = await this.candidateRepository.findOne({
          where: { id: args.id },
          relations: ['candidatePositions', 'candidatePositions.position'],
        });
        if (!candidate) return { error: '候选人不存在' };
        return {
          id: candidate.id,
          name: candidate.name,
          gender: candidate.gender,
          idType: candidate.idType,
          idNumber: candidate.idNumber,
          contactPhone: candidate.contactPhone,
          contactEmail: candidate.contactEmail,
          educationType: candidate.educationType,
          education: candidate.education,
          domainYears: candidate.domainYears,
          workStatus: candidate.workStatus,
          expectedSalary: candidate.expectedSalary,
          supplier: candidate.supplier,
          resumeText: candidate.resumeText,
          positions: candidate.candidatePositions?.map(cp => ({
            positionId: cp.positionId,
            positionDuty: cp.position?.positionDuty,
            matchScore: cp.matchScore,
            status: cp.status,
          })) || [],
        };
      }
      case 'import_candidates_from_data': {
        const items: any[] = args.items || [];
        let successCount = 0;
        const errors: string[] = [];
        for (let i = 0; i < items.length; i++) {
          try {
            const item = items[i];
            const candidate = this.candidateRepository.create({
              name: item.name || '未命名',
              gender: item.gender || '未提供',
              idType: item.idType || '身份证',
              idNumber: item.idNumber || '',
              contactPhone: item.contactPhone || '',
              contactEmail: item.contactEmail || '',
              educationType: item.educationType || '统招',
              education: item.education || '未提供',
              domainYears: item.domainYears ? Number(item.domainYears) : null,
              workStatus: item.workStatus || '未提供',
              expectedSalary: item.expectedSalary || '未提供',
              supplier: item.supplier || '未提供',
            });
            await this.candidateRepository.save(candidate);
            successCount++;
          } catch (err: any) {
            errors.push(`第${i + 1}条导入失败: ${err.message || '未知错误'}`);
          }
        }
        return { successCount, totalItems: items.length, errors, message: `成功导入${successCount}条候选人数据` };
      }
      // ===== Assignment/Matching tools =====
      case 'assign_candidate_to_position': {
        const existing = await this.candidatePositionRepository.findOne({
          where: { candidateId: args.candidateId, positionId: args.positionId },
        });
        if (existing) return { error: '该候选人已分配到此岗位' };
        const cp = this.candidatePositionRepository.create({
          candidateId: args.candidateId,
          positionId: args.positionId,
          matchScore: 0,
          status: 'pending_screen',
          recommendedAt: new Date(),
        });
        const result = await this.candidatePositionRepository.save(cp);
        return { id: result.id, candidateId: args.candidateId, positionId: args.positionId, message: '候选人已分配到岗位' };
      }
      case 'list_position_candidates': {
        const cps = await this.candidatePositionRepository.find({
          where: { positionId: args.positionId },
          relations: ['candidate'],
        });
        return cps.map(cp => ({
          id: cp.id,
          candidateId: cp.candidateId,
          candidateName: cp.candidate?.name,
          matchScore: cp.matchScore,
          status: cp.status,
          recommendReason: cp.recommendReason,
        }));
      }
      case 'match_candidate': {
        return this.matchCandidate({ id: args.candidateId } as any, { id: args.positionId } as any, userId);
      }
      // ===== Interview tools =====
      case 'list_interviews': {
        const interviews = await this.interviewRepository.find({
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
      case 'create_interview': {
        // First find or create the candidate_position record
        let cp = await this.candidatePositionRepository.findOne({
          where: { candidateId: args.candidateId, positionId: args.positionId },
        });
        if (!cp) {
          cp = this.candidatePositionRepository.create({
            candidateId: args.candidateId,
            positionId: args.positionId,
            matchScore: 0,
            status: 'pending_interview',
            recommendedAt: new Date(),
          });
          cp = await this.candidatePositionRepository.save(cp);
        }
        const interview = this.interviewRepository.create({
          candidatePositionId: cp.id,
          round: args.round || 1,
          interviewerId: args.interviewerId || userId,
          scheduledAt: new Date(args.interviewDate),
          result: 'pending',
        });
        const result = await this.interviewRepository.save(interview);
        return { id: result.id, candidateId: args.candidateId, positionId: args.positionId, scheduledAt: result.scheduledAt, round: result.round, message: '面试安排创建成功' };
      }
      // ===== Export tools =====
      case 'export_positions_csv': {
        const where: any = {};
        if (args.projectId) where.projectId = args.projectId;
        const positions = await this.positionRepository.find({ where });
        const headers = 'ID,系统,部门,岗位职务,岗位类型,技术领域,紧急程度,状态,需求人数,已录用人数,地区';
        const rows = positions.map(p =>
          `${p.id},${p.systemName},${p.department},${p.positionDuty},${p.positionType},${p.techDomain},${p.urgency},${p.status},${p.requiredCount},${p.hiredCount},${p.region}`
        );
        const csv = [headers, ...rows].join('\n');
        return { csv, count: positions.length, message: `已生成${positions.length}条岗位CSV数据` };
      }
      case 'export_candidates_csv': {
        let candidates: Candidate[];
        if (args.positionId) {
          const cps = await this.candidatePositionRepository.find({
            where: { positionId: args.positionId },
            relations: ['candidate'],
          });
          candidates = cps.map(cp => cp.candidate).filter(Boolean);
        } else {
          candidates = await this.candidateRepository.find();
        }
        const headers = 'ID,姓名,性别,学历,领域年限,工作状态,期望薪资,供应商,联系电话,邮箱';
        const rows = candidates.map(c =>
          `${c.id},${c.name},${c.gender || ''},${c.education || ''},${c.domainYears || ''},${c.workStatus || ''},${c.expectedSalary || ''},${c.supplier || ''},${c.contactPhone || ''},${c.contactEmail || ''}`
        );
        const csv = [headers, ...rows].join('\n');
        return { csv, count: candidates.length, message: `已生成${candidates.length}条候选人CSV数据` };
      }
      // ===== Dashboard/Stats tools =====
      case 'get_dashboard_stats': {
        const totalProjects = await this.projectRepository.count();
        const totalPositions = await this.positionRepository.count();
        const totalCandidates = await this.candidateRepository.count();
        const openPositions = await this.positionRepository.count({ where: { status: 'open' } });
        const filledPositions = await this.positionRepository.count({ where: { status: 'filled' } });
        const partialPositions = await this.positionRepository.count({ where: { status: 'partial' } });
        const closedPositions = await this.positionRepository.count({ where: { status: 'closed' } });

        // Count candidates by work status
        const allCandidates = await this.candidateRepository.find();
        const candidatesByWorkStatus: Record<string, number> = {};
        for (const c of allCandidates) {
          const ws = c.workStatus || '未知';
          candidatesByWorkStatus[ws] = (candidatesByWorkStatus[ws] || 0) + 1;
        }

        // Count positions by urgency
        const urgentPositions = await this.positionRepository.count({ where: { urgency: 'critical' } });
        const highUrgencyPositions = await this.positionRepository.count({ where: { urgency: 'high' } });

        // Total assignments
        const totalAssignments = await this.candidatePositionRepository.count();

        return {
          totalProjects,
          totalPositions,
          totalCandidates,
          openPositions,
          filledPositions,
          partialPositions,
          closedPositions,
          urgentPositions,
          highUrgencyPositions,
          totalAssignments,
          candidatesByWorkStatus,
        };
      }
      // ===== AI tools =====
      case 'analyze_risk': {
        return this.analyzeRisk({}, userId);
      }
      case 'generate_report': {
        const params: any = {};
        if (args.type === 'position') params.positionId = args.positionId;
        if (args.type === 'project') params.projectId = args.projectId;
        return this.generateReport(args.type, params, userId);
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }

  async importFile(fileContent: string, fileType: string, userId: number) {
    const { client, model } = await this.getClient(userId);

    const prompt = `请解析以下${fileType}文件内容，提取其中的岗位需求或候选人信息，返回JSON格式：
{
  "type": "position" 或 "candidate",
  "data": { ... 解析后的结构化数据 }
}

文件内容：
${fileContent}`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';

    await this.logService.log(userId, 'import_file', 'ai', null, {
      fileType,
      model,
    });

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return { rawContent: content };
    }
  }
}
