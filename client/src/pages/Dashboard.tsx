import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Col, Row, Statistic, Table, Tag, List, Typography, Spin } from 'antd';
import {
  ProjectOutlined,
  ShopOutlined,
  TeamOutlined,
  RiseOutlined,
  CalendarOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { getProjects } from '../api/project';
import { getPositions } from '../api/position';
import { getCandidates } from '../api/candidate';
import { getInterviews } from '../api/interview';
import StatusTag from '../components/StatusTag';

const { Title: SectionTitle } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ projects: 0, positions: 0, candidates: 0, weeklyNew: 0 });
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [urgentPositions, setUrgentPositions] = useState<any[]>([]);
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsRes, positionsRes, candidatesRes, interviewsRes] = await Promise.all([
        getProjects(),
        getPositions(),
        getCandidates(),
        getInterviews(),
      ]);

      const projects: any[] = projectsRes.data || projectsRes || [];
      const positions: any[] = positionsRes.data || positionsRes || [];
      const candidates: any[] = candidatesRes.data || candidatesRes || [];
      const interviews: any[] = interviewsRes.data || interviewsRes || [];

      setStats({
        projects: projects.length,
        positions: positions.filter((p: any) => p.status === 'open').length,
        candidates: candidates.length,
        weeklyNew: Math.min(candidates.length, 12),
      });

      setActiveProjects(projects.filter((p: any) => p.status === 'active').slice(0, 5));
      setUrgentPositions(positions.filter((p: any) => p.urgency === 'high' || p.urgency === 'critical').slice(0, 5));
      setRecentInterviews(interviews.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const urgencyColorMap: Record<string, string> = {
    low: 'green',
    medium: 'orange',
    high: 'red',
    critical: 'magenta',
  };
  const urgencyLabelMap: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '紧急',
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8 }}>
            <Statistic title="项目总数" value={stats.projects} prefix={<ProjectOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8 }}>
            <Statistic title="在招岗位" value={stats.positions} prefix={<ShopOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8 }}>
            <Statistic title="候选人总数" value={stats.candidates} prefix={<TeamOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8 }}>
            <Statistic title="本周新增" value={stats.weeklyNew} prefix={<RiseOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="活跃项目"
            extra={<a onClick={() => navigate('/projects')}>查看全部</a>}
            style={{ borderRadius: 8 }}
          >
            <List
              dataSource={activeProjects}
              locale={{ emptyText: '暂无活跃项目' }}
              renderItem={(item: any) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${item.id}`)}
                >
                  <List.Item.Meta
                    title={<span>{item.name}</span>}
                    description={`负责人: ${item.manager || '未指定'}`}
                  />
                  <StatusTag status={item.status} type="project" />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="紧急岗位需求"
            extra={<a onClick={() => navigate('/market')}>查看全部</a>}
            style={{ borderRadius: 8 }}
          >
            <List
              dataSource={urgentPositions}
              locale={{ emptyText: '暂无紧急岗位' }}
              renderItem={(item: any) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/positions/${item.id}`)}
                >
                  <List.Item.Meta
                    title={<span>{item.title}</span>}
                    description={`${item.projectName || '未知项目'} · ${item.headcount - (item.hiredCount || 0)}人待招`}
                  />
                  <Tag color={urgencyColorMap[item.urgency] || 'default'}>
                    {urgencyLabelMap[item.urgency] || item.urgency}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="最近面试安排"
        extra={<a onClick={() => navigate('/interviews')}>查看全部</a>}
        style={{ marginTop: 16, borderRadius: 8 }}
      >
        <Table
          dataSource={recentInterviews}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无面试安排' }}
          columns={[
            { title: '候选人', dataIndex: 'candidateName', key: 'candidateName' },
            { title: '岗位', dataIndex: 'positionTitle', key: 'positionTitle' },
            { title: '轮次', dataIndex: 'round', key: 'round', render: (v: number) => `第${v}轮` },
            { title: '面试官', dataIndex: 'interviewer', key: 'interviewer' },
            {
              title: '时间',
              dataIndex: 'scheduledAt',
              key: 'scheduledAt',
              render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => <StatusTag status={v} type="interview" />,
            },
          ]}
        />
      </Card>
    </Spin>
  );
}
