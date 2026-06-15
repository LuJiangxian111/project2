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
import { SystemConfigService } from '../system-config/system-config.service';
import OpenAI from 'openai';
import {
  SkillRegistry,
  SkillContext,
  ProjectSkill,
  PositionSkill,
  CandidateSkill,
  AssignmentSkill,
  InterviewSkill,
  ResumeSkill,
  ExportSkill,
  DashboardSkill,
  AnalysisSkill,
} from './skills';

const DEFAULT_LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_LLM_API_KEY = process.env.LLM_API_KEY || '';
const DEFAULT_LLM_MODEL = process.env.LLM_MODEL || 'gpt-3.5-turbo';

@Injectable()
export class AiService {
  private currentSavedFiles: { fileName: string; savedUrl: string; size: number }[] = [];
  private skillRegistry: SkillRegistry;

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
    private systemConfigService: SystemConfigService,
  ) {
    // 初始化 Skill 注册表
    this.skillRegistry = new SkillRegistry();
    this.skillRegistry.register(new ProjectSkill());
    this.skillRegistry.register(new PositionSkill());
    this.skillRegistry.register(new CandidateSkill());
    this.skillRegistry.register(new AssignmentSkill());
    this.skillRegistry.register(new InterviewSkill());
    this.skillRegistry.register(new ResumeSkill());
    this.skillRegistry.register(new ExportSkill());
    this.skillRegistry.register(new DashboardSkill());
    this.skillRegistry.register(new AnalysisSkill());
    console.log(`[AI] Skills 注册完成: ${this.skillRegistry.getRegisteredSkills().join(', ')}`);
    console.log(`[AI] 可用工具: ${this.skillRegistry.getToolNames().join(', ')}`);
  }

  private async getClient(userId: number): Promise<{
    client: OpenAI;
    model: string;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const systemLlm = await this.systemConfigService.getLlmConfig();

    // 用户选择使用系统内置AI，或者用户没有自定义配置时使用系统配置
    const useSystemLlm = user?.useSystemLlm !== false; // 默认使用系统配置
    const hasUserConfig = !!(user?.llmApiKey);

    let apiKey: string;
    let baseURL: string;
    let model: string;

    if (useSystemLlm || !hasUserConfig) {
      // 使用系统内置AI配置
      apiKey = systemLlm.apiKey || DEFAULT_LLM_API_KEY;
      baseURL = systemLlm.baseUrl || DEFAULT_LLM_BASE_URL;
      model = systemLlm.model || DEFAULT_LLM_MODEL;
    } else {
      // 使用用户自定义AI配置
      apiKey = user.llmApiKey || systemLlm.apiKey || DEFAULT_LLM_API_KEY;
      baseURL = user.llmBaseUrl || systemLlm.baseUrl || DEFAULT_LLM_BASE_URL;
      model = user.llmModel || systemLlm.model || DEFAULT_LLM_MODEL;
    }

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
- gender: 性别（男/女）
- yearsOfExperience: 工作年限（数字）
- currentCompany: 当前公司/供应商
- skills: 技能列表(数组)
- education: 学历（如：本科、硕士、大专）
- educationType: 学历类型（如：统招、自考、成教）
- workStatus: 工作状态（如：在职、离职、待业）
- expectedSalary: 期望薪资
- summary: 简历摘要

请确保name和phone字段准确提取，这是最重要的两个字段。如果无法确定某个字段，请返回空字符串。

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

    // 如果候选人只有id（从controller传入的裸对象），从数据库加载完整实体
    if (candidate.id && !candidate.name) {
      const fullCandidate = await this.candidateRepository.findOne({ where: { id: candidate.id } });
      if (fullCandidate) {
        candidate = fullCandidate;
      }
    }

    // 如果岗位只有id（从controller传入的裸对象），从数据库加载完整实体
    if (position.id && !position.positionDuty) {
      const fullPosition = await this.positionRepository.findOne({ where: { id: position.id } });
      if (fullPosition) {
        position = fullPosition;
      }
    }

    // 如果简历文本为空但有简历链接，尝试读取简历文件内容
    let resumeText = candidate.resumeText || '';
    if (!resumeText && candidate.resumeUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const resumePath = path.join(__dirname, '..', '..', '..', candidate.resumeUrl.replace(/^\//, ''));
        if (fs.existsSync(resumePath)) {
          const ext = candidate.resumeUrl.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(resumePath);
            const pdfData = await pdfParse(dataBuffer);
            resumeText = pdfData.text || '';
          } else if (ext === 'xlsx' || ext === 'xls') {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(resumePath);
            const allText: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              allText.push(XLSX.utils.sheet_to_csv(sheet));
            }
            resumeText = allText.join('\n\n');
          } else if (ext === 'docx' || ext === 'doc') {
            // docx/doc暂无法直接提取，标记信息
            resumeText = `[Word简历文件已上传，路径: ${candidate.resumeUrl}，文件大小: ${(fs.statSync(resumePath).size / 1024).toFixed(1)}KB]`;
          } else {
            const buffer = fs.readFileSync(resumePath);
            resumeText = buffer.toString('utf-8').substring(0, 30000);
          }
          // 保存到数据库以便后续使用
          if (resumeText) {
            candidate.resumeText = resumeText.substring(0, 30000);
            await this.candidateRepository.save(candidate);
          }
        }
      } catch (err) {
        console.error('[AI] 读取简历文件失败:', err?.message || err);
      }
    }

    const candidateInfo = `
姓名: ${candidate.name}
性别: ${candidate.gender || '未提供'}
学历类型: ${candidate.educationType || '未提供'}
学历: ${candidate.education || '未提供'}
领域年限: ${candidate.domainYears || '未提供'}
工作状态: ${candidate.workStatus || '未提供'}
期望薪资: ${candidate.expectedSalary || '未提供'}
供应商: ${candidate.supplier || '未提供'}
简历链接: ${candidate.resumeUrl || '未提供'}
简历内容: ${resumeText || '未提供'}`;

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

    const prompt = `你是一名资深技术招聘专家，请对以下候选人与岗位进行深度匹配分析。

请按以下步骤逐步分析（Chain-of-Thought）：

第一步：提取岗位核心要求
- 从岗位任职要求和岗位职责中提取必须技能（Must-have）和加分技能（Nice-to-have）
- 识别最低学历要求、经验年限要求、领域要求

第二步：分析候选人资质
- 从简历内容中提取候选人的核心技能、项目经验、教育背景
- 识别与岗位相关的关键经历和成就

第三步：逐项匹配对比
- 技能匹配：候选人技能覆盖了哪些必须技能和加分技能，缺失哪些
- 经验匹配：候选人的工作年限、项目经验是否满足岗位要求
- 学历匹配：候选人学历是否达到岗位要求
- 领域匹配：候选人所在行业/技术领域与岗位的契合度

第四步：综合评估
- 根据以上分析给出匹配分数和详细评价

请严格返回以下JSON格式（不要包含其他文字）：
{
  "score": 匹配分数(0-100的整数，基于以下权重：技能匹配40%+经验匹配25%+学历匹配15%+领域匹配20%),
  "detail": {
    "skillMatch": {
      "score": 技能匹配分(0-100),
      "analysis": "技能匹配分析说明",
      "matchedSkills": ["已匹配的技能1", "已匹配的技能2"],
      "missingSkills": ["缺失的技能1", "缺失的技能2"]
    },
    "experienceMatch": {
      "score": 经验匹配分(0-100),
      "analysis": "经验匹配分析说明",
      "relevantExperience": ["相关经验1", "相关经验2"]
    },
    "educationMatch": {
      "score": 学历匹配分(0-100),
      "analysis": "学历匹配分析说明"
    },
    "domainMatch": {
      "score": 领域匹配分(0-100),
      "analysis": "领域匹配分析说明"
    },
    "overallAnalysis": "综合分析总结（100-200字）",
    "strengths": ["优势1", "优势2", "优势3"],
    "weaknesses": ["不足1", "不足2"],
    "suggestions": "改进建议"
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

  /**
   * 当对话消息过长时，将早期消息压缩为摘要，保留系统提示+摘要+最近几条消息
   */
  private async summarizeMessages(
    client: OpenAI,
    model: string,
    messages: { role: string; content: string }[],
    maxRecentMessages: number = 6,
    maxTotalChars: number = 20000,
  ): Promise<{ role: string; content: string }[]> {
    // 计算总字符数
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (totalChars <= maxTotalChars || messages.length <= maxRecentMessages) {
      return messages;
    }

    // 分离早期消息和最近消息
    const earlyMessages = messages.slice(0, messages.length - maxRecentMessages);
    const recentMessages = messages.slice(messages.length - maxRecentMessages);

    if (earlyMessages.length === 0) {
      return messages;
    }

    // 构建摘要请求
    const conversationText = earlyMessages
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n\n');

    try {
      const summaryResponse = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system' as const,
            content: '你是一个对话摘要助手。请将以下对话历史压缩为简洁的摘要，保留所有关键信息、讨论的主题、已做出的决定、以及提到的文件内容要点。摘要应该足够详细，使得AI助手在后续对话中仍能理解之前的上下文。用中文回复。',
          },
          {
            role: 'user' as const,
            content: `请总结以下对话历史：\n\n${conversationText}`,
          },
        ],
        temperature: 0.3,
      }, { timeout: 60000 });

      const summary = summaryResponse.choices[0]?.message?.content || '';
      console.log(`[AI] 对话摘要生成完成，原始${earlyMessages.length}条消息(${totalChars}字符) → 摘要${summary.length}字符`);

      // 返回摘要消息 + 最近消息
      return [
        {
          role: 'system' as const,
          content: `[之前的对话摘要]\n${summary}`,
        },
        ...recentMessages,
      ];
    } catch (err) {
      console.error('[AI] 生成对话摘要失败，使用原始消息:', err?.message || err);
      // 摘要失败时，至少截断早期过长的消息
      return messages.slice(messages.length - maxRecentMessages);
    }
  }

  /**
   * 从消息中提取文件内容并生成简要摘要，用于系统提示
   */
  private async generateFileSummary(
    client: OpenAI,
    model: string,
    fileContent: string,
    fileName: string,
  ): Promise<string> {
    if (!fileContent || fileContent.length < 500) return fileContent;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system' as const,
            content: '请将以下文件内容压缩为简要摘要，保留关键数据、结构和重要信息点。用中文回复，控制在500字以内。',
          },
          {
            role: 'user' as const,
            content: `文件名: ${fileName}\n\n文件内容:\n${fileContent.substring(0, 15000)}`,
          },
        ],
        temperature: 0.3,
      }, { timeout: 60000 });

      return response.choices[0]?.message?.content || fileContent.substring(0, 500);
    } catch (err) {
      console.error('[AI] 生成文件摘要失败:', err?.message || err);
      return fileContent.substring(0, 500);
    }
  }

  async agentChat(messages: { role: string; content: string }[], userId: number, savedFiles?: { fileName: string; savedUrl: string; size: number }[]) {
    const { client, model } = await this.getClient(userId);

    // 存储已保存的文件信息，供工具使用
    this.currentSavedFiles = savedFiles || [];

    // 从 Skill 注册表获取所有工具定义
    const tools = this.skillRegistry.getAllToolDefinitions();

    const systemMessage = {
      role: 'system' as const,
      content: `你是一个智能招聘管理助手，可以完全控制和管理整个招聘平台。你可以执行以下操作：

项目管理：创建、查看、更新、删除项目
岗位管理：创建、查看、更新、删除岗位，按需求编号/岗位名称搜索岗位，批量导入岗位数据，导出岗位数据为CSV
候选人管理：添加、查看、更新、删除候选人，按姓名/手机号搜索候选人，批量导入候选人数据，导出候选人数据为CSV，上传候选人简历文件
分配管理：将候选人分配到岗位，查看岗位的候选人列表，批量更新候选人在岗位中的状态
候选人状态说明：pending_screen(待筛选)、screen_rejected(筛选未通过)、screen_passed(筛选通过)、pending_interview(待面试)、interview_passed(面试通过)、interview_rejected(面试未通过)、abandoned(已放弃)、pending_onboard(待入职)、onboarded(已入职)
面试管理：智能安排面试（支持通过姓名/电话查找候选人，通过项目/岗位名定位），创建面试安排，查看面试列表
AI分析：候选人匹配分析、风险分析、生成报告
数据统计：查看仪表盘统计数据

重要规则：
1. 当用户提供需求编号（如R2508209923）时，必须使用search_positions工具按requirementNumber搜索，不要用list_positions
2. 当用户提供候选人姓名时，使用search_candidates工具搜索
3. 当用户上传文件要求导入时，先理解文件内容，然后调用相应的导入工具。如果用户指定了目标岗位，先用search_positions找到岗位ID，再导入
4. 当用户要求导出数据时，调用导出工具生成CSV格式数据，用\`\`\`csv和\`\`\`包裹CSV内容
5. 操作完成后，用中文向用户汇报结果。如果参数不完整，请主动询问
6. **面试安排规则**：当用户要求安排面试时，优先使用schedule_interview工具。该工具支持通过候选人姓名/电话、项目名、岗位名来智能匹配。如果用户提供的面试信息中缺少项目或岗位信息，你必须主动询问用户该候选人面试的是哪个项目和岗位，然后再安排

文件识别规则（非常重要）：
当用户上传文件时，你必须首先识别文件类型，然后根据不同类型执行不同操作：

1. **简历文件**（PDF/Word/图片格式，文件名含人名，内容是个人经历/技能/教育背景）：
   - 识别意图：用户想上传简历给候选人
   - 必须主动询问：这些简历要上传到哪个项目、哪个岗位？（除非用户已明确指定）
   - 使用upload_candidate_resume工具上传简历
   - 如果简历文件名包含人名，尝试匹配系统中的候选人

2. **岗位需求文件**（Excel/CSV格式，包含岗位职务、需求人数、部门、系统等列）：
   - 识别意图：用户想批量导入岗位需求
   - 必须主动询问：这些岗位要导入到哪个项目？（除非用户已明确指定）
   - **重要**：文件内容已解析为JSON格式，每行是一个对象，键名是Excel表头列名
   - 直接将JSON数据原样传给import_positions_from_data工具的items参数，不要修改键名！系统会自动映射
   - 例如：如果Excel列名是"岗位"，传{"岗位":"Java开发"}，不要改成{"positionDuty":"Java开发"}
   - 绝对不要自己重新构建数据或遗漏字段，直接传原始JSON数据

3. **候选人列表文件**（Excel/CSV格式，包含姓名、电话、学历、供应商等列）：
   - 识别意图：用户想批量导入候选人
   - 必须主动询问：这些候选人要分配到哪个岗位？（除非用户已明确指定）
   - 先用search_positions找到目标岗位，再使用import_candidates_from_data导入
   - **重要**：文件内容已解析为JSON格式，直接将原始JSON数据传给工具，不要修改键名，系统会自动映射

4. **不确定的文件**：
   - 先分析文件内容，判断最可能的类型
   - 向用户确认文件类型和操作意图后再执行

Excel文件处理规则（非常重要）：
- 文件内容已解析为JSON格式，每行数据是一个对象，键名是表头列名
- 你必须严格按照JSON数据中的每一行来构建导入数据，一行对应一条记录
- 绝对不能凭空捏造数据，也不能遗漏任何一行
- 如果JSON数据有22行，就必须导入22条记录
- 字段映射时，仔细匹配表头列名和工具参数名的含义，不要张冠李戴
- 如果某列数据为空，对应字段填null或空字符串，不要编造内容
- 导入前先向用户展示你识别到的总行数和字段映射关系，确认后再执行导入
- 导入完成后，报告成功导入的数量，如果与文件行数不一致，说明原因`,
    };

    // 对用户消息进行摘要处理：当消息过长时压缩早期消息
    const processedMessages = await this.summarizeMessages(client, model, messages, 6, 20000);

    const allMessages = [systemMessage, ...processedMessages] as any[];

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
          const context: SkillContext = {
            userId,
            projectRepository: this.projectRepository,
            positionRepository: this.positionRepository,
            candidateRepository: this.candidateRepository,
            candidatePositionRepository: this.candidatePositionRepository,
            interviewRepository: this.interviewRepository,
            userRepository: this.userRepository,
            logService: this.logService,
            savedFiles: this.currentSavedFiles,
            aiService: {
              matchCandidate: this.matchCandidate.bind(this),
              analyzeRisk: this.analyzeRisk.bind(this),
              generateReport: this.generateReport.bind(this),
            },
          };
          functionResult = await this.skillRegistry.execute(functionName, args, context);
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
