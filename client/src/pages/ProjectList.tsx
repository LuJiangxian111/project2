import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Input, Modal, Form, Select, DatePicker, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { getProjects, createProject, deleteProject, updateProject } from '../api/project';
import StatusTag from '../components/StatusTag';

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res: any = await getProjects();
      setProjects(res.data || res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditItem(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      message.success('删除成功');
      loadProjects();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editItem) {
        await updateProject(editItem.id, values);
        message.success('更新成功');
      } else {
        await createProject(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadProjects();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '操作失败');
    }
  };

  const filtered = projects.filter(
    (p) => !keyword || p.name.includes(keyword) || (p.manager && p.manager.includes(keyword)),
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Input
          placeholder="搜索项目名称/负责人"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建项目
        </Button>
      </div>

      <Table
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
              <a onClick={() => navigate(`/projects/${record.id}`)}>{text}</a>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (v: string) => <StatusTag status={v} type="project" />,
          },
          { title: '负责人', dataIndex: 'manager', key: 'manager' },
          {
            title: '开始日期',
            dataIndex: 'startDate',
            key: 'startDate',
            render: (v: string) => (v ? v.substring(0, 10) : '-'),
          },
          {
            title: '岗位数',
            dataIndex: 'positionCount',
            key: 'positionCount',
            render: (v: number) => v || 0,
          },
          {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
              <Space>
                <a onClick={() => navigate(`/projects/${record.id}`)}>查看</a>
                <a onClick={() => handleEdit(record)}>编辑</a>
                <Popconfirm title="确定删除该项目吗？" onConfirm={() => handleDelete(record.id)}>
                  <a style={{ color: '#ff4d4f' }}>删除</a>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editItem ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} placeholder="请输入项目描述" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="planning">
            <Select>
              <Select.Option value="planning">规划中</Select.Option>
              <Select.Option value="active">进行中</Select.Option>
              <Select.Option value="paused">已暂停</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="manager" label="负责人">
            <Input placeholder="请输入负责人" />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
