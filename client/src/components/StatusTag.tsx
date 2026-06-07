import { Tag } from 'antd';

interface StatusTagProps {
  status: string;
  type?: 'project' | 'position' | 'candidate' | 'interview';
}

const projectStatusMap: Record<string, { color: string; label: string }> = {
  planning: { color: 'blue', label: '规划中' },
  active: { color: 'green', label: '进行中' },
  completed: { color: 'default', label: '已完成' },
  paused: { color: 'orange', label: '已暂停' },
};

const positionStatusMap: Record<string, { color: string; label: string }> = {
  open: { color: 'green', label: '招聘中' },
  closed: { color: 'default', label: '已关闭' },
  paused: { color: 'orange', label: '已暂停' },
  filled: { color: 'blue', label: '已满员' },
};

const candidateStatusMap: Record<string, { color: string; label: string }> = {
  pending_screen: { color: 'default', label: '待筛选' },
  screen_rejected: { color: 'red', label: '筛选不通过' },
  screen_passed: { color: 'blue', label: '筛选通过待约面' },
  pending_interview: { color: 'orange', label: '待面试' },
  interview_passed: { color: 'green', label: '面试通过' },
  interview_rejected: { color: 'volcano', label: '面试不通过' },
  abandoned: { color: 'default', label: '放弃面试' },
  pending_onboard: { color: 'cyan', label: '待入职' },
  onboarded: { color: 'geekblue', label: '已入职' },
};

const interviewStatusMap: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: '已安排' },
  completed: { color: 'green', label: '已完成' },
  cancelled: { color: 'default', label: '已取消' },
  no_show: { color: 'red', label: '未出席' },
};

const statusMaps: Record<string, Record<string, { color: string; label: string }>> = {
  project: projectStatusMap,
  position: positionStatusMap,
  candidate: candidateStatusMap,
  interview: interviewStatusMap,
};

export default function StatusTag({ status, type = 'project' }: StatusTagProps) {
  const map = statusMaps[type] || projectStatusMap;
  const item = map[status] || { color: 'default', label: status };
  return <Tag color={item.color}>{item.label}</Tag>;
}
