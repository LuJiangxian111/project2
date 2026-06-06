import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Button, Space, Popconfirm, Tag, message, Modal, Form, Select, InputNumber } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { getCandidates, createCandidate, deleteCandidate, updateCandidate } from '../api/candidate';
import { matchCandidate } from '../api/candidate';
import { getPositions } from '../api/position';

export default function CandidateList() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form] = Form.useForm();
  const [positions, setPositions] = useState<any[]>([]);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchCandidateId, setMatchCandidateId] = useState<number | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);

  useEffect(() => {
    loadCandidates();
    getPositions().then((res: any) => setPositions(res.data || res || []));
  }, []);

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const res: any = await getCandidates();
      setCandidates(res.data || res || []);
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
      await deleteCandidate(id);
      message.success('删除成功');
      loadCandidates();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editItem) {
        await updateCandidate(editItem.id, values);
        message.success('更新成功');
      } else {
        await createCandidate(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadCandidates();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '操作失败');
    }
  };

  const handleMatch = (candidateId: number) => {
    setMatchCandidateId(candidateId);
    setSelectedPositionId(null);
    setMatchModalOpen(true);
  };

  const doMatch = async () => {
    if (!matchCandidateId || !selectedPositionId) {
      message.warning('请选择岗位');
      return;
    }
    try {
      await matchCandidate(matchCandidateId, selectedPositionId);
      message.success('AI匹配分析完成');
      setMatchModalOpen(false);
    } catch (err: any) {
      message.error(err.message || '匹配分析失败');
    }
  };

  const filtered = candidates.filter(
    (c) =>
      !keyword ||
      c.name.includes(keyword) ||
      (c.phone && c.phone.includes(keyword)) ||
      (c.currentCompany && c.currentCompany.includes(keyword)),
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Input
          placeholder="搜索姓名/手机/公司"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建候选人
        </Button>
      </div>

      <Table
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          {
            title: '姓名',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
              <a onClick={() => navigate(`/candidates/${record.id}`)}>{text}</a>
            ),
          },
          { title: '手机', dataIndex: 'phone', key: 'phone' },
          {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            render: (v: string) => {
              const map: Record<string, string> = { referral: '内推', website: '官网', headhunter: '猎头', social: '社交', other: '其他' };
              return map[v] || v || '-';
            },
          },
          { title: '工作年限', dataIndex: 'yearsOfExperience', key: 'yearsOfExperience', render: (v: number) => (v != null ? `${v}年` : '-') },
          { title: '当前公司', dataIndex: 'currentCompany', key: 'currentCompany' },
          {
            title: '技能标签',
            dataIndex: 'skills',
            key: 'skills',
            render: (v: string) =>
              v
                ? v.split(',').map((s: string, i: number) => (
                    <Tag key={i} color="blue" style={{ marginBottom: 2 }}>
                      {s.trim()}
                    </Tag>
                  ))
                : '-',
          },
          { title: '关联岗位', dataIndex: 'positionCount', key: 'positionCount', render: (v: number) => v || 0 },
          {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
              <Space>
                <a onClick={() => navigate(`/candidates/${record.id}`)}>查看</a>
                <a onClick={() => handleEdit(record)}>编辑</a>
                <a onClick={() => handleMatch(record.id)}>AI匹配</a>
                <Popconfirm title="确定删除该候选人吗？" onConfirm={() => handleDelete(record.id)}>
                  <a style={{ color: '#ff4d4f' }}>删除</a>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editItem ? '编辑候选人' : '新建候选人'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Select placeholder="请选择来源" allowClear>
              <Select.Option value="referral">内推</Select.Option>
              <Select.Option value="website">官网投递</Select.Option>
              <Select.Option value="headhunter">猎头</Select.Option>
              <Select.Option value="social">社交媒体</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="yearsOfExperience" label="工作年限">
            <InputNumber min={0} max={50} placeholder="工作年限" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="currentCompany" label="当前公司">
            <Input placeholder="请输入当前公司" />
          </Form.Item>
          <Form.Item name="skills" label="技能标签">
            <Input placeholder="多个技能用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="AI匹配分析"
        open={matchModalOpen}
        onOk={doMatch}
        onCancel={() => setMatchModalOpen(false)}
      >
        <div style={{ marginTop: 16 }}>
          <p>请选择要匹配的岗位：</p>
          {positions.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无可选岗位</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {positions.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPositionId(p.id)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${selectedPositionId === p.id ? '#1890ff' : '#d9d9d9'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedPositionId === p.id ? '#e6f7ff' : 'transparent',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{p.title}</span>
                  <span style={{ color: '#999', marginLeft: 12 }}>{p.projectName || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
