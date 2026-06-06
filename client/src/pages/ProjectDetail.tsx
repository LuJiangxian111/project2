import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tabs, Table, Button, Modal, Form, Input, Select, InputNumber, Space, Popconfirm, message, Spin } from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getProject, updateProject, deleteProject, getProjectPositions } from '../api/project';
import { createPosition, deletePosition } from '../api/position';
import StatusTag from '../components/StatusTag';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectRes, positionsRes] = await Promise.all([
        getProject(Number(id)),
        getProjectPositions(Number(id)),
      ]);
      const proj = (projectRes as any).data || projectRes;
      const pos = (positionsRes as any).data || positionsRes || [];
      setProject(proj);
      setPositions(pos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePosition = async () => {
    try {
      const values = await form.validateFields();
      await createPosition({ ...values, projectId: Number(id) });
      message.success('岗位创建成功');
      setPositionModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '创建失败');
    }
  };

  const handleDeletePosition = async (posId: number) => {
    try {
      await deletePosition(posId);
      message.success('删除成功');
      loadData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!project) return <div>项目不存在</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>
        返回项目列表
      </Button>

      <Card style={{ borderRadius: 8, marginBottom: 16 }}>
        <Descriptions title={project.name} column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="状态">
            <StatusTag status={project.status} type="project" />
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{project.manager || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始日期">{project.startDate ? project.startDate.substring(0, 10) : '-'}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{project.endDate ? project.endDate.substring(0, 10) : '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{project.description || '暂无描述'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ borderRadius: 8 }}>
        <Tabs
          items={[
            {
              key: 'positions',
              label: '岗位需求',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setPositionModalOpen(true); }}>
                      新建岗位
                    </Button>
                  </div>
                  <Table
                    dataSource={positions}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: '暂无岗位需求' }}
                    columns={[
                      {
                        title: '岗位名称',
                        dataIndex: 'title',
                        key: 'title',
                        render: (text: string, record: any) => (
                          <a onClick={() => navigate(`/positions/${record.id}`)}>{text}</a>
                        ),
                      },
                      {
                        title: '紧急程度',
                        dataIndex: 'urgency',
                        key: 'urgency',
                        render: (v: string) => {
                          const map: Record<string, { color: string; label: string }> = {
                            low: { color: 'green', label: '低' },
                            medium: { color: 'orange', label: '中' },
                            high: { color: 'red', label: '高' },
                            critical: { color: 'magenta', label: '紧急' },
                          };
                          const item = map[v] || { color: 'default', label: v };
                          return <span style={{ color: item.color === 'default' ? undefined : item.color, fontWeight: 500 }}>{item.label}</span>;
                        },
                      },
                      {
                        title: '需求/已录用',
                        key: 'headcount',
                        render: (_: any, r: any) => `${r.hiredCount || 0}/${r.requiredCount || 0}`,
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        render: (v: string) => <StatusTag status={v} type="position" />,
                      },
                      {
                        title: '操作',
                        key: 'action',
                        render: (_: any, record: any) => (
                          <Space>
                            <a onClick={() => navigate(`/positions/${record.id}`)}>查看</a>
                            <Popconfirm title="确定删除该岗位吗？" onConfirm={() => handleDeletePosition(record.id)}>
                              <a style={{ color: '#ff4d4f' }}>删除</a>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'info',
              label: '项目信息',
              children: (
                <Descriptions column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
                  <Descriptions.Item label="状态"><StatusTag status={project.status} type="project" /></Descriptions.Item>
                  <Descriptions.Item label="负责人">{project.manager || '-'}</Descriptions.Item>
                  <Descriptions.Item label="开始日期">{project.startDate ? project.startDate.substring(0, 10) : '-'}</Descriptions.Item>
                  <Descriptions.Item label="结束日期">{project.endDate ? project.endDate.substring(0, 10) : '-'}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{project.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>{project.description || '暂无描述'}</Descriptions.Item>
                </Descriptions>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新建岗位"
        open={positionModalOpen}
        onOk={handleCreatePosition}
        onCancel={() => setPositionModalOpen(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
          <Form.Item name="description" label="岗位描述">
            <Input.TextArea rows={3} placeholder="请输入岗位描述" />
          </Form.Item>
          <Form.Item name="requirements" label="岗位要求">
            <Input.TextArea rows={3} placeholder="请输入岗位要求" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="salaryMin" label="最低薪资" style={{ width: 200 }}>
              <InputNumber min={0} placeholder="最低薪资" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="salaryMax" label="最高薪资" style={{ width: 200 }}>
              <InputNumber min={0} placeholder="最高薪资" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="工作地点">
            <Input placeholder="请输入工作地点" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="urgency" label="紧急程度" initialValue="medium" style={{ width: 200 }}>
              <Select>
                <Select.Option value="low">低</Select.Option>
                <Select.Option value="medium">中</Select.Option>
                <Select.Option value="high">高</Select.Option>
                <Select.Option value="critical">紧急</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="headcount" label="需求人数" initialValue={1} style={{ width: 200 }}>
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
