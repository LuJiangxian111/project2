import { Tag } from 'antd';

interface MatchScoreTagProps {
  score: number;
}

export default function MatchScoreTag({ score }: MatchScoreTagProps) {
  let color = 'red';
  if (score >= 90) color = 'green';
  else if (score >= 75) color = 'blue';
  else if (score >= 60) color = 'orange';

  return <Tag color={color}>{score}分</Tag>;
}
