import { Repository } from 'typeorm';
import { Project } from '../../../entities/project.entity';
import { Position } from '../../../entities/position.entity';
import { Candidate } from '../../../entities/candidate.entity';
import { CandidatePosition } from '../../../entities/candidate-position.entity';
import { Interview } from '../../../entities/interview.entity';
import { User } from '../../../entities/user.entity';
import { LogService } from '../../log/log.service';

/**
 * Skill 接口定义
 * 每个 Skill 是一个独立的 AI 能力模块，包含工具定义和执行逻辑
 */
export interface ISkill {
  /** Skill 唯一标识 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** Skill 分类 */
  category: string;
  /** OpenAI Function Calling 工具定义 */
  toolDefinitions: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }[];
  /** 执行工具调用 */
  execute(
    functionName: string,
    args: any,
    context: SkillContext,
  ): Promise<any>;
}

/**
 * Skill 执行上下文
 * 提供 Skill 执行时所需的依赖和状态
 */
export interface SkillContext {
  userId: number;
  projectRepository: Repository<Project>;
  positionRepository: Repository<Position>;
  candidateRepository: Repository<Candidate>;
  candidatePositionRepository: Repository<CandidatePosition>;
  interviewRepository: Repository<Interview>;
  userRepository: Repository<User>;
  logService: LogService;
  /** 当前已保存的文件列表 */
  savedFiles: { fileName: string; savedUrl: string; size: number }[];
  /** AI 服务方法引用（用于 matchCandidate 等需要 LLM 的操作） */
  aiService: {
    matchCandidate: (candidate: any, position: any, userId: number) => Promise<any>;
    analyzeRisk: (params: any, userId: number) => Promise<any>;
    generateReport: (type: string, params: any, userId: number) => Promise<any>;
  };
}

/**
 * Skill 注册表
 * 管理所有已注册的 Skills，提供工具聚合和路由功能
 */
export class SkillRegistry {
  private skills: Map<string, ISkill> = new Map();
  private toolToSkill: Map<string, ISkill> = new Map();

  /** 注册一个 Skill */
  register(skill: ISkill): void {
    this.skills.set(skill.name, skill);
    for (const tool of skill.toolDefinitions) {
      this.toolToSkill.set(tool.function.name, skill);
    }
  }

  /** 获取所有工具定义（用于传给 LLM） */
  getAllToolDefinitions(): {
    type: 'function';
    function: { name: string; description: string; parameters: any };
  }[] {
    const tools: any[] = [];
    for (const skill of this.skills.values()) {
      tools.push(...skill.toolDefinitions);
    }
    return tools;
  }

  /** 根据工具名路由到对应 Skill 执行 */
  async execute(
    functionName: string,
    args: any,
    context: SkillContext,
  ): Promise<any> {
    const skill = this.toolToSkill.get(functionName);
    if (!skill) {
      return { error: `未知函数: ${functionName}` };
    }
    return skill.execute(functionName, args, context);
  }

  /** 获取所有已注册的 Skill 名称 */
  getRegisteredSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  /** 获取所有工具名称 */
  getToolNames(): string[] {
    return Array.from(this.toolToSkill.keys());
  }
}
