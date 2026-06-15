import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Interview } from '../../entities/interview.entity';
import { DiscussionService } from '../discussion/discussion.service';

@Injectable()
export class InterviewReminderService {
  // 记录已提醒的面试ID，避免重复提醒
  private remindedInterviewIds = new Set<number>();

  constructor(
    @InjectRepository(Interview)
    private interviewRepository: Repository<Interview>,
    private discussionService: DiscussionService,
  ) {}

  // 每30分钟检查一次即将到来的面试
  @Cron('*/30 * * * *')
  async checkUpcomingInterviews() {
    try {
      const now = new Date();
      // 查找30分钟到2小时内的面试
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const interviews = await this.interviewRepository
        .createQueryBuilder('interview')
        .leftJoinAndSelect('interview.candidatePosition', 'cp')
        .leftJoinAndSelect('cp.candidate', 'candidate')
        .leftJoinAndSelect('cp.position', 'position')
        .leftJoinAndSelect('interview.interviewer', 'interviewer')
        .where('interview.scheduledAt > :now', { now })
        .andWhere('interview.scheduledAt <= :twoHoursLater', { twoHoursLater })
        .andWhere('interview.result = :result', { result: 'pending' })
        .getMany();

      for (const interview of interviews) {
        // 避免重复提醒
        if (this.remindedInterviewIds.has(interview.id)) continue;

        const cp = interview.candidatePosition;
        if (!cp?.position?.projectId) continue;

        const scheduledTime = new Date(interview.scheduledAt);
        const minutesLeft = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
        const timeStr = scheduledTime.toLocaleString('zh-CN');

        const mentionIds: number[] = [];
        if (interview.interviewerId) mentionIds.push(interview.interviewerId);
        if (cp.recommenderId) mentionIds.push(cp.recommenderId);

        await this.discussionService.sendBotMessageByProject(
          cp.position.projectId,
          `⏰ 面试提醒：候选人「${cp.candidate?.name || '未知'}」的面试将在${minutesLeft}分钟后开始，岗位「${cp.position?.positionDuty || '未知'}」，时间：${timeStr}`,
          mentionIds,
          'interview',
          interview.id,
          {
            id: interview.id,
            candidateName: cp.candidate?.name,
            positionDuty: cp.position?.positionDuty,
            scheduledAt: interview.scheduledAt,
            minutesLeft,
          },
        );

        this.remindedInterviewIds.add(interview.id);
      }

      // 清理过期的提醒记录（超过24小时的）
      if (this.remindedInterviewIds.size > 1000) {
        this.remindedInterviewIds.clear();
      }
    } catch (err) {
      console.error('[InterviewReminder] 检查面试提醒失败:', err?.message || err);
    }
  }
}
