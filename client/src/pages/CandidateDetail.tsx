import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Spin, Tag, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getCandidate } from '../api/candidate';
import { getInterviews } from '../api/interview';
import { getPositions } from '../api/position';
import MatchScoreTag from '../components/MatchScoreTag';
import StatusTag from '../components/StatusTag';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [candRes, interviewRes, posRes] = await Promise.all([
        getCandidate(Number(id)),
        getInterviews(),
        getPositions(),
      ]);
      setCandidate((candRes as any).data || candRes);
      const allInterviews: any[] = (interviewRes as any).data || interviewRes || [];
      setInterviews(allInterviews.filter((i: any) => i.candidateId === Number(id)));
      setPositions((posRes as any).data || posRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!candidate) return <div>候选人不存在</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回
      </Button>

      <Card title="基本信息" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="姓名">{candidate.name}</Descriptions.Item>
          <Descriptions.Item label="手机">{candidate.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{candidate.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="来源">
            {({ referral: '内推', website: '官网', headhunter: '猎头', social: '社交', other: '其他' } as any)[candidate.source] || candidate.source || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="工作年限">
            {candidate.yearsOfExperience != null ? `${candidate.yearsOfExperience}年` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="当前公司">{candidate.currentCompany || '-'}</Descriptions.Item>
          <Descriptions.Item label="技能标签" span={3}>
            {candidate.skills
              ? candidate.skills.split(',').map((s: string, i: number) => (
                  <Tag key={i} color="blue" style={{ marginBottom: 2 }}>{s.trim()}</Tag>
                ))
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="关联岗位" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Table
          dataSource={positions.filter((p: any) => {
            return true;
          })}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无关联岗位' }}
          columns={[
            {
              title: '岗位名称',
              dataIndex: 'title',
              key: 'title',
              render: (text: string, record: any) => (
                <a onClick={() => navigate(`/positions/${record.id}`)}>{text}</a>
              ),
            },
            { title: '所属项目', dataIndex: 'projectName', key: 'projectName' },
            {
              title: '匹配分数',
              dataIndex: 'matchScore',
              key: 'matchScore',
              render: (v: number) => (v != null ? <MatchScoreTag score={v} /> : '-'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => <StatusTag status={v} type="candidate" />,
            },
          ]}
        />
      </Card>

      <Card title="面试记录" style={{ borderRadius: 8 }}>
        <Table
          dataSource={interviews}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无面试记录' }}
          columns={[
            {
              title: '岗位',
              dataIndex: 'positionTitle',
              key: 'positionTitle',
              render: (text: string, record: any) => (
                <a onClick={() => navigate(`/positions/${record.positionId}`)}>{text}</a>
              ),
            },
            { title: '轮次', dataIndex: 'round', key: 'round', render: (v: number) => `第${v}轮` },
            { title: '面试官', dataIndex: 'interviewer', key: 'interviewer' },
            {
              title: '时间',
              dataIndex: 'scheduledAt',
              key: 'scheduledAt',
              render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
            },
            { title: '结果', dataIndex: 'result', key: 'result', render: (v: string) => v || '-' },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => <StatusTag status={v} type="interview" />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
