import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  List,
  Typography,
  Spin,
  Select,
  Progress,
  Space,
  DatePicker,
} from 'antd';
import {
  ProjectOutlined,
  ShopOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { getProjects } from '../api/project';
import { getPositions, getDashboardStats } from '../api/position';
import StatusTag from '../components/StatusTag';

const { Title: SectionTitle } = Typography;

interface DashboardStats {
  totalProjects: number;
  totalPositions: number;
  openPositions: number;
  totalCandidates: number;
  totalInterviews: number;
  screeningPassRate: number;
  interviewPassRate: number;
  recentActivities: {
    id: number;
    time: string;
    recommenderName: string;
    projectName: string;
    positionDuty: string;
    positionImplementation: string;
    candidateName: string;
    status: string;
  }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [activityStartDate, setActivityStartDate] = useState<string | undefined>();
  const [activityEndDate, setActivityEndDate] = useState<string | undefined>();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalPositions: 0,
    openPositions: 0,
    totalCandidates: 0,
    totalInterviews: 0,
    screeningPassRate: 0,
    interviewPassRate: 0,
    recentActivities: [],
  });
  const [urgentPositions, setUrgentPositions] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsRes, statsRes, positionsRes] = await Promise.all([
        getProjects(),
        getDashboardStats(selectedProjectId),
        getPositions(selectedProjectId ? { projectId: selectedProjectId } : undefined),
      ]);

      const projectsData: any[] = projectsRes.data || projectsRes || [];
      const statsData = statsRes.data || statsRes;
      const positionsData: any[] = positionsRes.data || positionsRes || [];

      setProjects(projectsData);
      setStats(statsData);
      setUrgentPositions(
        positionsData
          .filter((p: any) => p.urgency === 'high' || p.urgency === 'critical')
          .slice(0, 5),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const filteredActivities = stats.recentActivities.filter((a) => {
    if (!a.time) return true;
    const date = new Date(a.time);
    if (activityStartDate && date < new Date(activityStartDate)) return false;
    if (activityEndDate && date > new Date(activityEndDate + 'T23:59:59')) return false;
    return true;
  });

  const activityColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '上传者',
      dataIndex: 'recommenderName',
      key: 'recommenderName',
      width: 100,
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 120,
    },
    {
      title: '岗位',
      dataIndex: 'positionDuty',
      key: 'positionDuty',
      width: 140,
    },
    {
      title: '岗位实施',
      dataIndex: 'positionImplementation',
      key: 'positionImplementation',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '候选人姓名',
      dataIndex: 'candidateName',
      key: 'candidateName',
      width: 110,
    },
    {
      title: '候选人状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: string) => <StatusTag status={v} type="candidate" />,
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* 项目筛选 */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space>
          <span style={{ fontWeight: 500 }}>项目筛选：</span>
          <Select
            style={{ width: 240 }}
            placeholder="全部项目"
            allowClear
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val || undefined)}
            options={projects.map((p: any) => ({ label: p.name, value: p.id }))}
          />
        </Space>
      </Card>

      {/* 统计卡片行 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #1890ff' }}>
            <Statistic
              title="项目总数"
              value={stats.totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #52c41a' }}>
            <Statistic
              title="在招岗位"
              value={stats.openPositions}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #722ed1' }}>
            <Statistic
              title="候选人总数"
              value={stats.totalCandidates}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #fa8c16' }}>
            <Statistic
              title="面试安排"
              value={stats.totalInterviews}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 通过率行 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card
            hoverable
            style={{ borderRadius: 8 }}
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
                <span>筛选通过率</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={stats.screeningPassRate}
                size={120}
                strokeColor="#1890ff"
                format={(percent) => `${percent}%`}
              />
              <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                筛选通过及后续阶段的候选人占比
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            hoverable
            style={{ borderRadius: 8 }}
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>面试通过率</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={stats.interviewPassRate}
                size={120}
                strokeColor="#52c41a"
                format={(percent) => `${percent}%`}
              />
              <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                面试通过及入职阶段的候选人占比
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近活动表 */}
      <Card
        title="最近推荐活动"
        style={{ marginTop: 16, borderRadius: 8 }}
        extra={
          <Space>
            <span style={{ fontSize: 13, color: '#666' }}>日期筛选：</span>
            <DatePicker.RangePicker
              size="small"
              onChange={(_, dateStrings) => {
                setActivityStartDate(dateStrings[0] || undefined);
                setActivityEndDate(dateStrings[1] || undefined);
              }}
              allowClear
              placeholder={['开始日期', '结束日期']}
            />
          </Space>
        }
      >
        <Table
          dataSource={filteredActivities}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无推荐活动' }}
          columns={activityColumns}
          scroll={{ x: 950, y: 400 }}
          size="middle"
        />
      </Card>

      {/* 紧急岗位需求 */}
      <Card
        title="紧急岗位需求"
        extra={<a onClick={() => navigate('/market')}>查看全部</a>}
        style={{ marginTop: 16, borderRadius: 8 }}
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
                title={<span>{item.positionDuty}</span>}
                description={`${item.project?.name || item.projectName || '未知项目'} · ${item.requiredCount - (item.hiredCount || 0)}人待招`}
              />
              <Tag color={urgencyColorMap[item.urgency] || 'default'}>
                {urgencyLabelMap[item.urgency] || item.urgency}
              </Tag>
            </List.Item>
          )}
        />
      </Card>
    </Spin>
  );
}
