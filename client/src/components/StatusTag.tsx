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
  pending: { color: 'default', label: '待评估' },
  screening: { color: 'blue', label: '筛选中' },
  interviewing: { color: 'orange', label: '面试中' },
  offered: { color: 'green', label: '已发Offer' },
  rejected: { color: 'red', label: '已拒绝' },
  hired: { color: 'cyan', label: '已录用' },
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
