import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Select, DatePicker, Button, Space, Modal, Form, Input, InputNumber, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { getInterviews, createInterview, updateInterview, generateQuestions } from '../api/interview';
import { getCandidates } from '../api/candidate';
import { getPositions } from '../api/position';
import StatusTag from '../components/StatusTag';

export default function InterviewList() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [currentInterview, setCurrentInterview] = useState<any>(null);
  const [form] = Form.useForm();
  const [feedbackForm] = Form.useForm();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    Promise.all([getCandidates(), getPositions()]).then(([candRes, posRes]) => {
      setCandidates((candRes as any).data || candRes || []);
      setPositions((posRes as any).data || posRes || []);
    });
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res: any = await getInterviews({ status: filterStatus });
      setInterviews(res.data || res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createInterview(values);
      message.success('面试创建成功');
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '创建失败');
    }
  };

  const handleFeedback = (record: any) => {
    setCurrentInterview(record);
    feedbackForm.setFieldsValue({ result: record.result, feedback: record.feedback });
    setFeedbackModalOpen(true);
  };

  const submitFeedback = async () => {
    try {
      const values = await feedbackForm.validateFields();
      await updateInterview(currentInterview.id, values);
      message.success('反馈提交成功');
      setFeedbackModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '提交失败');
    }
  };

  const handleGenerateQuestions = async (id: number) => {
    try {
      await generateQuestions(id);
      message.success('AI面试问题生成成功');
      loadData();
    } catch (err: any) {
      message.error(err.message || '生成失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Select
            placeholder="筛选状态"
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); loadData(); }}
            allowClear
            style={{ width: 140 }}
          >
            <Select.Option value="scheduled">已安排</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
        </Space>
        <Button type="primary" onClick={() => { form.resetFields(); setCreateModalOpen(true); }}>
          新建面试
        </Button>
      </div>

      <Table
        dataSource={interviews}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          {
            title: '候选人',
            dataIndex: 'candidateName',
            key: 'candidateName',
            render: (text: string, record: any) => (
              <a onClick={() => navigate(`/candidates/${record.candidateId}`)}>{text}</a>
            ),
          },
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
          {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
              <Space>
                <a onClick={() => navigate(`/candidates/${record.candidateId}`)}>查看</a>
                <a onClick={() => handleFeedback(record)}>填写反馈</a>
                <a onClick={() => handleGenerateQuestions(record.id)}>
                  <RobotOutlined /> AI问题
                </a>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="新建面试"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => setCreateModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="candidateId" label="候选人" rules={[{ required: true, message: '请选择候选人' }]}>
            <Select placeholder="请选择候选人" showSearch optionFilterProp="children">
              {candidates.map((c: any) => (
                <Select.Option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="positionId" label="岗位" rules={[{ required: true, message: '请选择岗位' }]}>
            <Select placeholder="请选择岗位" showSearch optionFilterProp="children">
              {positions.map((p: any) => (
                <Select.Option key={p.id} value={p.id}>{p.title}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="round" label="面试轮次" initialValue={1}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="interviewer" label="面试官">
            <Input placeholder="请输入面试官姓名" />
          </Form.Item>
          <Form.Item name="scheduledAt" label="面试时间">
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="填写面试反馈"
        open={feedbackModalOpen}
        onOk={submitFeedback}
        onCancel={() => setFeedbackModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={feedbackForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="result" label="面试结果">
            <Select placeholder="请选择面试结果" allowClear>
              <Select.Option value="pass">通过</Select.Option>
              <Select.Option value="fail">未通过</Select.Option>
              <Select.Option value="pending">待定</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="feedback" label="面试反馈">
            <Input.TextArea rows={4} placeholder="请输入面试反馈" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
