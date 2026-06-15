import { ISkill, SkillContext } from './skill-registry';

export class ProjectSkill implements ISkill {
  name = 'project';
  description = '项目管理：创建、查看、更新、删除项目';
  category = 'management';

  toolDefinitions = [
    {
      type: 'function' as const,
      function: {
        name: 'list_projects',
        description: '获取项目列表',
        parameters: { type: 'object', properties: {} },
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
          properties: { id: { type: 'number', description: '项目ID' } },
          required: ['id'],
        },
      },
    },
  ];

  async execute(functionName: string, args: any, ctx: SkillContext): Promise<any> {
    switch (functionName) {
      case 'list_projects': {
        const projects = await ctx.projectRepository.find({ order: { createdAt: 'DESC' } });
        return projects.map(p => ({ id: p.id, name: p.name, status: p.status, description: p.description }));
      }
      case 'create_project': {
        const project = ctx.projectRepository.create({
          name: args.name,
          description: args.description || '',
          status: args.status || 'planning',
          managerId: ctx.userId,
        });
        const result = await ctx.projectRepository.save(project);
        return { id: result.id, name: result.name, status: result.status, message: '项目创建成功' };
      }
      case 'update_project': {
        const project = await ctx.projectRepository.findOne({ where: { id: args.id } });
        if (!project) return { error: '项目不存在' };
        if (args.name !== undefined) project.name = args.name;
        if (args.description !== undefined) project.description = args.description;
        if (args.status !== undefined) project.status = args.status;
        const result = await ctx.projectRepository.save(project);
        return { id: result.id, name: result.name, status: result.status, message: '项目更新成功' };
      }
      case 'delete_project': {
        const project = await ctx.projectRepository.findOne({ where: { id: args.id } });
        if (!project) return { error: '项目不存在' };
        await ctx.projectRepository.remove(project);
        return { id: args.id, message: '项目删除成功' };
      }
      default:
        return { error: `未知函数: ${functionName}` };
    }
  }
}
