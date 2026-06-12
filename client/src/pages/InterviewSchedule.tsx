import { useEffect, useState, useCallback } from 'react';
import {
  Table, Select, Modal, Form, Tag, Button, DatePicker, Input, Space, Card, message, Dropdown,
} from 'antd';
import { PlusOutlined, DownOutlined } from '@ant-design/icons';
import { getInterviews, createInterview, updateInterview, Interview } from '../api/interview';
import { getPositions } from '../api/position';
import { getProjects } from '../api/project';
import { getCandidatesGrouped } from '../api/candidate';

const INTERVIEW_TYPE_MAP: Record<string, string> = {
  online: '线上',
  onsite: '现场',
  phone: '电话',
  video: '视频',
};

const RESULT_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待面试', color: 'blue' },
  pass: { label: '面试通过', color: 'green' },
  fail: { label: '面试不通过', color: 'red' },
  cancel: { label: '放弃面试', color: 'default' },
};

const RESULT_OPTIONS = [
  { value: 'pass', label: '面试通过' },
  { value: 'fail', label: '面试不通过' },
  { value: 'cancel', label: '放弃面试' },
];

export default function InterviewSchedule() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [candidatePositionOptions, setCandidatePositionOptions] = useState<any[]>([]);
  const [modalProjectId, setModalProjectId] = useState<number | undefined>();
  const [modalPositionId, setModalPositionId] = useState<number | undefined>();
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>();
  const [filterResult, setFilterResult] = useState<string | undefined>();

  // 创建面试弹窗
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // 更新结果弹窗
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultForm] = Form.useForm();
  const [resultLoading, setResultLoading] = useState(false);
  const [currentInterview, setCurrentInterview] = useState<Interview | null>(null);
  const [selectedResult, setSelectedResult] = useState<string>('');

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailInterview, setDetailInterview] = useState<Interview | null>(null);

  useEffect(() => {
    getProjects().then((res: any) => setProjects(res.data || res || []));
    getPositions().then((res: any) => setPositions(res.data || res || []));
    getCandidatesGrouped().then((res: any) => {
      const data = res.data || res || [];
      setCandidates(data);
    });
  }, []);

  // 新建弹窗：按项目筛选岗位
  const modalFilterPositions = modalProjectId
    ? positions.filter((p: any) => p.projectId === modalProjectId)
    : positions;

  // 新建弹窗：按项目/岗位筛选候选人
  const filteredCandidates = candidates.filter((c: any) => {
    if (!modalProjectId && !modalPositionId) return true;
    if (!c.positions || c.positions.length === 0) return false;
    if (modalPositionId) {
      return c.positions.some((cp: any) => cp.positionId === modalPositionId);
    }
    return c.positions.some((cp: any) => cp.projectId === modalProjectId);
  });

  const candidateKey = (c: any) => `${c.name}||${c.contactPhone || ''}`;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await getInterviews({
        result: filterResult,
        projectId: filterProjectId,
      });
      setInterviews(res.data || res || []);
    } catch {
      message.error('获取面试列表失败');
    } finally {
      setLoading(false);
    }
  }, [filterResult, filterProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const data: Partial<Interview> = {
        candidatePositionId: values.candidatePositionId,
        interviewType: values.interviewType,
        round: values.round || 1,
        scheduledAt: values.scheduledAt?.toISOString(),
        meetingLink: values.meetingLink,
      };
      await createInterview(data);
      message.success('面试创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateResult = async () => {
    if (!currentInterview) return;
    try {
      const values = await resultForm.validateFields();
      setResultLoading(true);
      await updateInterview(currentInterview.id, {
        result: selectedResult,
        feedback: values.feedback,
      });
      message.success('面试结果更新成功');
      setResultModalOpen(false);
      resultForm.resetFields();
      setCurrentInterview(null);
      setSelectedResult('');
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '更新失败');
    } finally {
      setResultLoading(false);
    }
  };

  const openResultModal = (interview: Interview, result: string) => {
    setCurrentInterview(interview);
    setSelectedResult(result);
    resultForm.resetFields();
    setResultModalOpen(true);
  };

  const openDetailModal = (interview: Interview) => {
    setDetailInterview(interview);
    setDetailModalOpen(true);
  };

  const handleCandidateSelect = (key: string) => {
    const candidate = filteredCandidates.find((c: any) => candidateKey(c) === key);
    setSelectedCandidate(candidate);
    if (candidate && candidate.positions) {
      setCandidatePositionOptions(
        candidate.positions.map((cp: any) => ({
          value: cp.cpId,
          label: `${cp.positionTitle || '岗位'} - ${cp.projectName || '未知项目'}`,
        }))
      );
    } else {
      setCandidatePositionOptions([]);
    }
    createForm.setFieldsValue({ candidatePositionId: undefined });
  };

  const columns = [
    {
      title: '候选人姓名',
      key: 'candidateName',
      width: 120,
      render: (_: any, record: Interview) =>
        record.candidatePosition?.candidate?.name || '-',
    },
    {
      title: '岗位',
      key: 'positionTitle',
      width: 150,
      render: (_: any, record: Interview) =>
        record.candidatePosition?.position?.positionDuty ||
        record.candidatePosition?.position?.systemName || '-',
    },
    {
      title: '面试形式',
      dataIndex: 'interviewType',
      key: 'interviewType',
      width: 100,
      render: (v: string) => INTERVIEW_TYPE_MAP[v] || v,
    },
    {
      title: '面试时间',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '会议链接/信息',
      dataIndex: 'meetingLink',
      key: 'meetingLink',
      width: 180,
      render: (v: string) => v ? (
        <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>
      ) : '-',
    },
    {
      title: '面试状态',
      dataIndex: 'result',
      key: 'result',
      width: 120,
      render: (v: string) => {
        const info = RESULT_MAP[v];
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>未知</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Interview) => (
        <Space>
          <Dropdown
            menu={{
              items: RESULT_OPTIONS.map((opt) => ({
                key: opt.value,
                label: opt.label,
              })),
              onClick: ({ key }) => openResultModal(record, key),
            }}
          >
            <Button size="small">
              更新结果 <DownOutlined />
            </Button>
          </Dropdown>
          <Button size="small" onClick={() => openDetailModal(record)}>
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="筛选项目"
            value={filterProjectId}
            onChange={setFilterProjectId}
            allowClear
            style={{ width: 180 }}
            options={projects.map((p: any) => ({ value: p.id, label: p.name }))}
          />
          <Select
            placeholder="筛选面试结果"
            value={filterResult}
            onChange={setFilterResult}
            allowClear
            style={{ width: 150 }}
            options={Object.entries(RESULT_MAP).map(([value, { label }]) => ({ value, label }))}
          />
          <Button onClick={() => { setFilterProjectId(undefined); setFilterResult(undefined); }}>
            重置
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateModalOpen(true); setModalProjectId(undefined); setModalPositionId(undefined); setSelectedCandidate(null); setCandidatePositionOptions([]); }}>
            新建面试
          </Button>
        </Space>
      </Card>

      <Table
        dataSource={interviews}
        rowKey="id"
        loading={loading}
        columns={columns}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 1050 }}
      />

      {/* 创建面试弹窗 */}
      <Modal
        title="新建面试"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); setSelectedCandidate(null); setCandidatePositionOptions([]); setModalProjectId(undefined); setModalPositionId(undefined); }}
        confirmLoading={createLoading}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="筛选项目">
            <Select
              placeholder="按项目筛选候选人"
              value={modalProjectId}
              onChange={(val) => { setModalProjectId(val); setModalPositionId(undefined); setSelectedCandidate(null); setCandidatePositionOptions([]); createForm.setFieldsValue({ candidatePositionId: undefined }); }}
              allowClear
              style={{ width: '100%' }}
              options={projects.map((p: any) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item label="筛选岗位">
            <Select
              placeholder="按岗位筛选候选人"
              value={modalPositionId}
              onChange={(val) => { setModalPositionId(val); setSelectedCandidate(null); setCandidatePositionOptions([]); createForm.setFieldsValue({ candidatePositionId: undefined }); }}
              allowClear
              style={{ width: '100%' }}
              options={modalFilterPositions.map((p: any) => ({ value: p.id, label: p.positionDuty || p.systemName }))}
            />
          </Form.Item>
          <Form.Item
            name="candidateKey"
            label="选择候选人"
            rules={[{ required: true, message: '请选择候选人' }]}
          >
            <Select
              placeholder="搜索姓名或电话号码"
              showSearch
              filterOption={(input, option) => {
                const label = (option?.label as string) || '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              onChange={handleCandidateSelect}
              options={filteredCandidates.map((c: any) => ({
                value: candidateKey(c),
                label: `${c.name}${c.contactPhone ? ' (' + c.contactPhone + ')' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="candidatePositionId"
            label="候选人岗位"
            rules={[{ required: true, message: '请选择候选人岗位' }]}
          >
            <Select
              placeholder={selectedCandidate ? '请选择岗位' : '请先选择候选人'}
              showSearch
              optionFilterProp="label"
              disabled={!selectedCandidate}
              options={candidatePositionOptions}
            />
          </Form.Item>
          <Form.Item
            name="interviewType"
            label="面试形式"
            rules={[{ required: true, message: '请选择面试形式' }]}
          >
            <Select
              placeholder="请选择面试形式"
              options={Object.entries(INTERVIEW_TYPE_MAP).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="round" label="面试轮次" initialValue={1}>
            <Input type="number" min={1} placeholder="请输入面试轮次" />
          </Form.Item>
          <Form.Item name="scheduledAt" label="面试时间">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="请选择面试时间"
            />
          </Form.Item>
          <Form.Item name="meetingLink" label="会议链接/信息">
            <Input placeholder="请输入会议链接或面试地点信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 更新面试结果弹窗 */}
      <Modal
        title={`更新面试结果 - ${RESULT_MAP[selectedResult]?.label || ''}`}
        open={resultModalOpen}
        onOk={handleUpdateResult}
        onCancel={() => { setResultModalOpen(false); resultForm.resetFields(); setCurrentInterview(null); setSelectedResult(''); }}
        confirmLoading={resultLoading}
        destroyOnClose
      >
        <Form form={resultForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="feedback" label="面试反馈">
            <Input.TextArea rows={4} placeholder="请输入面试反馈" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 面试详情弹窗 */}
      <Modal
        title="面试详情"
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setDetailInterview(null); }}
        footer={null}
        width={640}
        destroyOnClose
      >
        {detailInterview && (
          <div style={{ lineHeight: 2 }}>
            <p><strong>候选人姓名：</strong>{detailInterview.candidatePosition?.candidate?.name || '-'}</p>
            <p><strong>岗位：</strong>{detailInterview.candidatePosition?.position?.positionDuty || detailInterview.candidatePosition?.position?.systemName || '-'}</p>
            <p><strong>面试形式：</strong>{INTERVIEW_TYPE_MAP[detailInterview.interviewType] || detailInterview.interviewType}</p>
            <p><strong>面试轮次：</strong>第 {detailInterview.round} 轮</p>
            <p><strong>面试时间：</strong>{detailInterview.scheduledAt ? new Date(detailInterview.scheduledAt).toLocaleString('zh-CN') : '-'}</p>
            <p><strong>会议链接：</strong>{detailInterview.meetingLink ? <a href={detailInterview.meetingLink} target="_blank" rel="noopener noreferrer">{detailInterview.meetingLink}</a> : '-'}</p>
            <p><strong>面试状态：</strong>{(() => { const info = RESULT_MAP[detailInterview.result || 'pending']; return info ? <Tag color={info.color}>{info.label}</Tag> : '-'; })()}</p>
            <p><strong>面试官：</strong>{detailInterview.interviewer?.name || detailInterview.interviewer?.nickname || '-'}</p>
            <p><strong>面试反馈：</strong>{detailInterview.feedback || '-'}</p>
            <p><strong>AI面试题：</strong>{detailInterview.aiQuestions || '-'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
