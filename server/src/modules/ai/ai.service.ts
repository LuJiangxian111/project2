import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Position } from '../../entities/position.entity';
import { Candidate } from '../../entities/candidate.entity';
import { Project } from '../../entities/project.entity';
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
技能: ${candidate.skills || '未提供'}
工作年限: ${candidate.yearsOfExperience || '未提供'}
当前公司: ${candidate.currentCompany || '未提供'}
学历: ${candidate.education || '未提供'}
简历摘要: ${candidate.resumeText || '未提供'}
来源: ${candidate.source || '未知'}`;

    const positionInfo = `
岗位名称: ${position.title}
岗位描述: ${position.description}
任职要求: ${position.requirements}
薪资范围: ${position.salaryRange || '面议'}
工作地点: ${position.location || '未指定'}
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
- 技能: ${candidate.skills || '未提供'}
- 工作年限: ${candidate.yearsOfExperience || '未提供'}
- 学历: ${candidate.education || '未提供'}

岗位信息：
- 岗位名称: ${position.title}
- 岗位描述: ${position.description}
- 任职要求: ${position.requirements}

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

岗位：${position.title}
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
${project.positions?.map((p) => `- ${p.title}: 需${p.requiredCount}人/已录用${p.hiredCount}人, 紧急度${p.urgency}, 状态${p.status}`).join('\n') || '暂无岗位'}

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
      `- ${p.title}(${p.project?.name || '未知项目'}): 需${p.requiredCount}人/已录用${p.hiredCount}人, 紧急度${p.urgency}, 期望到岗${p.expectedDate}`,
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
