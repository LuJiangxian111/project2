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
  Modal,
  Button,
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
import { getPositions, getDashboardStats, getUploadStats } from '../api/position';
import { getCandidatesList } from '../api/candidate';
import { getInterviews } from '../api/interview';
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
  const [uploadStats, setUploadStats] = useState<any[]>([]);
  const [uploadStatsLoading, setUploadStatsLoading] = useState(false);
  const [uploadStartDate, setUploadStartDate] = useState<string | undefined>();
  const [uploadEndDate, setUploadEndDate] = useState<string | undefined>();

  // 卡片详情弹窗
  const [detailModal, setDetailModal] = useState<{ type: string; title: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [allPositions, setAllPositions] = useState<any[]>([]);

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
      setAllPositions(positionsData);
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

  // 加载每日上传统计
  const loadUploadStats = useCallback(async () => {
    try {
      setUploadStatsLoading(true);
      const res: any = await getUploadStats({
        projectId: selectedProjectId,
        startDate: uploadStartDate,
        endDate: uploadEndDate,
      });
      const data = res.data || res;
      setUploadStats(data.details || []);
    } catch {
      console.error('获取上传统计失败');
    } finally {
      setUploadStatsLoading(false);
    }
  }, [selectedProjectId, uploadStartDate, uploadEndDate]);

  useEffect(() => {
    loadUploadStats();
  }, [loadUploadStats]);

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

  // 打开卡片详情弹窗
  const openDetail = async (type: string, title: string) => {
    setDetailModal({ type, title });
    setDetailLoading(true);
    setDetailData([]);
    try {
      if (type === 'openPositions') {
        // 在招岗位列表（本地过滤）
        setDetailData(allPositions.filter((p: any) => p.status === 'open' || p.status === 'partial'));
      } else if (type === 'candidates') {
        const res: any = await getCandidatesList(selectedProjectId ? { projectId: selectedProjectId } : undefined);
        setDetailData(res.data || res || []);
      } else if (type === 'interviews') {
        const res: any = await getInterviews(selectedProjectId ? { projectId: selectedProjectId } : undefined);
        setDetailData(res.data || res || []);
      } else if (type === 'screeningRate' || type === 'interviewRate') {
        // 按岗位统计通过率
        const res: any = await getCandidatesList(selectedProjectId ? { projectId: selectedProjectId } : undefined);
        const list = res.data || res || [];
        const byPosition = new Map<number, any>();
        list.forEach((cp: any) => {
          if (!cp.positionId) return;
          if (!byPosition.has(cp.positionId)) {
            byPosition.set(cp.positionId, {
              positionId: cp.positionId,
              positionTitle: cp.positionDuty || cp.positionTitle || '-',
              projectName: cp.projectName || '-',
              total: 0,
              screenPassed: 0,
              interviewPassed: 0,
            });
          }
          const item = byPosition.get(cp.positionId);
          item.total++;
          const s = cp.status;
          // 筛选通过及后续阶段
          if (['screen_passed', 'pending_interview', 'interview_passed', 'pending_onboard', 'onboarded'].includes(s)) item.screenPassed++;
          // 面试通过及入职阶段
          if (['interview_passed', 'pending_onboard', 'onboarded'].includes(s)) item.interviewPassed++;
        });
        setDetailData(Array.from(byPosition.values()));
      }
    } catch (err) {
      console.error('加载详情失败', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // 详情弹窗各类型列定义
  const getDetailColumns = () => {
    const type = detailModal?.type;
    if (type === 'openPositions') {
      return [
        { title: '岗位职务', dataIndex: 'positionDuty', key: 'positionDuty', width: 160 },
        { title: '项目', key: 'projectName', width: 140, render: (_: any, r: any) => r.project?.name || r.projectName || '-' },
        { title: '部门', dataIndex: 'department', key: 'department', width: 100, render: (v: string) => v || '-' },
        { title: '需求人数', dataIndex: 'requiredCount', key: 'requiredCount', width: 90 },
        { title: '已录用', dataIndex: 'hiredCount', key: 'hiredCount', width: 80, render: (v: number) => v || 0 },
        { title: '紧急程度', dataIndex: 'urgency', key: 'urgency', width: 90, render: (v: string) => <Tag color={urgencyColorMap[v] || 'default'}>{urgencyLabelMap[v] || v}</Tag> },
        { title: '服务地点', dataIndex: 'serviceLocation', key: 'serviceLocation', width: 140, render: (v: string) => v || '-' },
        { title: '操作', key: 'action', width: 80, render: (_: any, r: any) => <a onClick={() => navigate(`/positions/${r.id}`)}>详情</a> },
      ];
    }
    if (type === 'candidates') {
      return [
        { title: '姓名', dataIndex: 'candidateName', key: 'candidateName', width: 90 },
        { title: '项目', dataIndex: 'projectName', key: 'projectName', width: 120, render: (v: string) => v || '-' },
        { title: '岗位', dataIndex: 'positionDuty', key: 'positionDuty', width: 140, render: (v: string) => v || '-' },
        { title: '推荐人', dataIndex: 'recommender', key: 'recommender', width: 90, render: (v: string) => v || '-' },
        { title: '推荐日期', dataIndex: 'pushDate', key: 'pushDate', width: 110, render: (v: string) => v ? v.substring(0, 10) : '-' },
        { title: '状态', dataIndex: 'status', key: 'status', width: 130, render: (v: string) => <StatusTag status={v} type="candidate" /> },
      ];
    }
    if (type === 'interviews') {
      return [
        { title: '候选人', dataIndex: 'candidateName', key: 'candidateName', width: 100, render: (_: any, r: any) => r.candidatePosition?.candidate?.name || r.candidateName || '-' },
        { title: '岗位', key: 'positionDuty', width: 140, render: (_: any, r: any) => r.candidatePosition?.position?.positionDuty || r.positionDuty || '-' },
        { title: '轮次', dataIndex: 'round', key: 'round', width: 70 },
        { title: '面试时间', dataIndex: 'scheduledAt', key: 'scheduledAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
        { title: '形式', dataIndex: 'interviewType', key: 'interviewType', width: 80, render: (v: string) => v === 'online' ? '线上' : v === 'onsite' ? '现场' : v || '-' },
        { title: '结果', dataIndex: 'result', key: 'result', width: 100, render: (v: string) => v ? <StatusTag status={v} type="interview" /> : '待定' },
      ];
    }
    // 通过率
    const isScreen = type === 'screeningRate';
    return [
      { title: '岗位', dataIndex: 'positionTitle', key: 'positionTitle', width: 160 },
      { title: '项目', dataIndex: 'projectName', key: 'projectName', width: 130, render: (v: string) => v || '-' },
      { title: '候选人总数', dataIndex: 'total', key: 'total', width: 100 },
      { title: isScreen ? '筛选通过数' : '面试通过数', dataIndex: isScreen ? 'screenPassed' : 'interviewPassed', key: 'passCount', width: 110 },
      {
        title: '通过率',
        key: 'rate',
        width: 140,
        render: (_: any, r: any) => {
          const rate = r.total > 0 ? Math.round(((isScreen ? r.screenPassed : r.interviewPassed) / r.total) * 100) : 0;
          return <Progress percent={rate} size="small" style={{ width: 100 }} strokeColor={isScreen ? '#1890ff' : '#52c41a'} />;
        },
      },
    ];
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
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #52c41a' }} onClick={() => openDetail('openPositions', '在招岗位详情')}>
            <Statistic
              title="在招岗位"
              value={stats.openPositions}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>点击查看岗位列表</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #722ed1' }} onClick={() => openDetail('candidates', '候选人概览')}>
            <Statistic
              title="候选人总数"
              value={stats.totalCandidates}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>点击查看候选人</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable style={{ borderRadius: 8, borderTop: '3px solid #fa8c16' }} onClick={() => openDetail('interviews', '面试安排详情')}>
            <Statistic
              title="面试安排"
              value={stats.totalInterviews}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>点击查看面试</div>
          </Card>
        </Col>
      </Row>

      {/* 通过率行 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card
            hoverable
            style={{ borderRadius: 8 }}
            onClick={() => openDetail('screeningRate', '各岗位筛选通过率')}
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
                <span>筛选通过率</span>
              </Space>
            }
            extra={<span style={{ fontSize: 12, color: '#999' }}>点击查看各岗位详情</span>}
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
            onClick={() => openDetail('interviewRate', '各岗位面试通过率')}
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>面试通过率</span>
              </Space>
            }
            extra={<span style={{ fontSize: 12, color: '#999' }}>点击查看各岗位详情</span>}
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

      {/* 每日推荐上传统计 */}
      <Card
        title="每日推荐上传统计"
        style={{ marginTop: 16, borderRadius: 8 }}
        extra={
          <Space>
            <span style={{ fontSize: 13, color: '#666' }}>日期筛选：</span>
            <DatePicker.RangePicker
              size="small"
              onChange={(_, dateStrings) => {
                setUploadStartDate(dateStrings[0] || undefined);
                setUploadEndDate(dateStrings[1] || undefined);
              }}
              allowClear
              placeholder={['开始日期', '结束日期']}
            />
          </Space>
        }
      >
        <Table
          dataSource={uploadStats}
          rowKey={(r) => `${r.date}-${r.recommenderId}-${r.positionId}`}
          loading={uploadStatsLoading}
          pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无上传统计数据' }}
          size="middle"
          scroll={{ x: 700 }}
          columns={[
            {
              title: '日期',
              dataIndex: 'date',
              key: 'date',
              width: 120,
              sorter: (a: any, b: any) => a.date?.localeCompare(b.date),
              defaultSortOrder: 'descend',
            },
            {
              title: '上传者',
              dataIndex: 'recommenderName',
              key: 'recommenderName',
              width: 110,
            },
            {
              title: '项目',
              dataIndex: 'projectName',
              key: 'projectName',
              width: 140,
              render: (v: string) => v || '-',
            },
            {
              title: '岗位',
              dataIndex: 'positionDuty',
              key: 'positionDuty',
              width: 160,
              render: (v: string) => v || '-',
            },
            {
              title: '上传数量',
              dataIndex: 'count',
              key: 'count',
              width: 100,
              sorter: (a: any, b: any) => a.count - b.count,
              render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
          ]}
          summary={(data) => {
            const total = data.reduce((sum, r) => sum + r.count, 0);
            return data.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>合计</div>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Tag color="green" style={{ fontWeight: 600 }}>{total}</Tag>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null;
          }}
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
      {/* 卡片详情弹窗 */}
      <Modal
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        width={860}
        title={detailModal?.title}
        footer={<Button onClick={() => setDetailModal(null)}>关闭</Button>}
      >
        <Table
          dataSource={detailData}
          rowKey={(r) => String(r.id ?? r.cpId ?? r.positionId ?? r.candidatePositionId ?? JSON.stringify(r))}
          loading={detailLoading}
          columns={getDetailColumns() as any}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          size="small"
          scroll={{ x: 800 }}
          locale={{ emptyText: '暂无数据' }}
        />
      </Modal>
    </Spin>
  );
}
