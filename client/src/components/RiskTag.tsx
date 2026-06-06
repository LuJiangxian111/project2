import { Tag } from 'antd';

interface RiskTagProps {
  level: string;
}

const riskColorMap: Record<string, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  critical: 'magenta',
};

const riskLabelMap: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重风险',
};

export default function RiskTag({ level }: RiskTagProps) {
  return <Tag color={riskColorMap[level] || 'default'}>{riskLabelMap[level] || level}</Tag>;
}
