import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Input, Select, Button, Tag, Space, Spin, Empty, Modal, Form, InputNumber, message } from 'antd';
import { SearchOutlined, PlusOutlined, EnvironmentOutlined, DollarOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getPositions, createPosition } from '../api/position';
import { getProjects } from '../api/project';
import StatusTag from '../components/StatusTag';

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

export default function PositionMarket() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [filterProject, setFilterProject] = useState<number | undefined>();
  const [filterUrgency, setFilterUrgency] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, projRes] = await Promise.all([getPositions(), getProjects()]);
      setPositions((posRes as any).data || posRes || []);
      setProjects((projRes as any).data || projRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const res: any = await getPositions({
        keyword: keyword || undefined,
        projectId: filterProject,
        urgency: filterUrgency,
        status: filterStatus,
      });
      setPositions(res.data || res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createPosition(values);
      message.success('岗位发布成功');
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '发布失败');
    }
  };

  const filtered = positions.filter((p) => {
    if (keyword && !p.title.includes(keyword) && !(p.projectName || '').includes(keyword)) return false;
    if (filterProject && p.projectId !== filterProject) return false;
    if (filterUrgency && p.urgency !== filterUrgency) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input
            placeholder="搜索岗位/项目关键词"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="所属项目"
            value={filterProject}
            onChange={setFilterProject}
            allowClear
            style={{ width: 160 }}
          >
            {projects.map((p) => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="紧急程度"
            value={filterUrgency}
            onChange={setFilterUrgency}
            allowClear
            style={{ width: 120 }}
          >
            <Select.Option value="low">低</Select.Option>
            <Select.Option value="medium">中</Select.Option>
            <Select.Option value="high">高</Select.Option>
            <Select.Option value="critical">紧急</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 120 }}
          >
            <Select.Option value="open">招聘中</Select.Option>
            <Select.Option value="paused">已暂停</Select.Option>
            <Select.Option value="filled">已满员</Select.Option>
            <Select.Option value="closed">已关闭</Select.Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>
          发布岗位需求
        </Button>
      </div>

      <Spin spinning={loading}>
        {filtered.length === 0 ? (
          <Empty description="暂无岗位需求" style={{ marginTop: 80 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((pos) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={pos.id}>
                <Card
                  hoverable
                  style={{ borderRadius: 8, height: '100%' }}
                  onClick={() => navigate(`/positions/${pos.id}`)}
                  styles={{ body: { padding: 20 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, flex: 1, marginRight: 8 }}>{pos.title}</h3>
                    <Tag color={urgencyColorMap[pos.urgency] || 'default'}>
                      {urgencyLabelMap[pos.urgency] || pos.urgency}
                    </Tag>
                  </div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 8 }}>
                    {pos.projectName || '未知项目'}
                  </div>
                  {(pos.salaryMin || pos.salaryMax) && (
                    <div style={{ marginBottom: 8, color: '#fa8c16', fontWeight: 500 }}>
                      <DollarOutlined style={{ marginRight: 4 }} />
                      {pos.salaryMin || '?'}K - {pos.salaryMax || '?'}K
                    </div>
                  )}
                  {pos.location && (
                    <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />
                      {pos.location}
                    </div>
                  )}
                  <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    需求 {pos.headcount || 0} 人 / 已录用 {pos.hiredCount || 0} 人
                  </div>
                  {pos.expectedDate && (
                    <div style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      期望到岗: {pos.expectedDate.substring(0, 10)}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <StatusTag status={pos.status} type="position" />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <Modal
        title="发布岗位需求"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select placeholder="请选择所属项目">
              {projects.map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="岗位描述">
            <Input.TextArea rows={3} placeholder="请输入岗位描述" />
          </Form.Item>
          <Form.Item name="requirements" label="岗位要求">
            <Input.TextArea rows={3} placeholder="请输入岗位要求" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="salaryMin" label="最低薪资(K)" style={{ width: 180 }}>
              <InputNumber min={0} placeholder="最低薪资" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="salaryMax" label="最高薪资(K)" style={{ width: 180 }}>
              <InputNumber min={0} placeholder="最高薪资" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="工作地点">
            <Input placeholder="请输入工作地点" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="urgency" label="紧急程度" initialValue="medium" style={{ width: 180 }}>
              <Select>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="critical">紧急</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="headcount" label="需求人数" initialValue={1} style={{ width: 180 }}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="expectedDate" label="期望到岗日期">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
