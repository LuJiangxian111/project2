import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Space, Spin, message, Modal, Upload, Steps, Input, Tag, Checkbox, Form, Select, Row, Col, Divider, Popconfirm } from 'antd';
import { ArrowLeftOutlined, RobotOutlined, PlusOutlined, ImportOutlined, UploadOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getPosition, getPositionCandidates, addCandidateToPosition, batchImportCandidates, updatePosition } from '../api/position';
import { matchAnalysis, analyzeFile } from '../api/ai';
import { getCandidate } from '../api/candidate';
import { getProjects } from '../api/project';
import StatusTag from '../components/StatusTag';
import MatchScoreTag from '../components/MatchScoreTag';
import CandidateModal from '../components/CandidateModal';
import { useUserStore } from '../stores/user';
import request from '../api/request';

const CANDIDATE_FIELDS = [
  'name', 'gender', 'idType', 'idNumber', 'contactPhone', 'contactEmail',
  'areaCode', 'supplier', 'educationType', 'education', 'graduationDate',
  'domainYears', 'workStatus', 'expectedSalary', 'recommender', 'recommendReason',
];

const FIELD_LABELS: Record<string, string> = {
  name: '姓名', gender: '性别', idType: '证件类型', idNumber: '证件号码',
  contactPhone: '联系电话', contactEmail: '联系邮箱', areaCode: '区号',
  supplier: '供应商', educationType: '学历类型', education: '学历',
  graduationDate: '毕业时间', domainYears: '领域年限', workStatus: '工作状态',
  expectedSalary: '期望薪资', recommender: '推荐人', recommendReason: '推荐理由',
};

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [position, setPosition] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [addExistingModalOpen, setAddExistingModalOpen] = useState(false);
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [projectList, setProjectList] = useState<any[]>([]);

  // 导入候选人相关状态
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

  // 候选人详情弹窗
  const [candidateDetailOpen, setCandidateDetailOpen] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);

  // 批量删除选中
  const [selectedCpIds, setSelectedCpIds] = useState<number[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 查看候选人详情
  const handleViewCandidate = async (candidateId: number) => {
    try {
      setCandidateDetailLoading(true);
      setCandidateDetailOpen(true);
      const res: any = await getCandidate(candidateId);
      const data = res.data || res;
      setCandidateDetail(data);
    } catch (err: any) {
      message.error('获取候选人详情失败');
    } finally {
      setCandidateDetailLoading(false);
    }
  };

  // 删除单个候选人
  const handleRemoveCandidate = async (cpId: number) => {
    try {
      await request.delete(`/positions/${id}/candidates/${cpId}`);
      message.success('移除成功');
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '移除失败');
    }
  };

  // 批量删除候选人
  const handleBatchRemove = async () => {
    if (selectedCpIds.length === 0) {
      message.warning('请先选择要移除的候选人');
      return;
    }
    try {
      setBatchDeleting(true);
      const res: any = await request.post(`/positions/${id}/candidates/batch-remove`, { cpIds: selectedCpIds });
      const data = res.data || res;
      message.success(`批量移除完成：成功 ${data.success} 条${data.failed > 0 ? `，失败 ${data.failed} 条` : ''}`);
      setSelectedCpIds([]);
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '批量移除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, candRes] = await Promise.all([
        getPosition(Number(id)),
        getPositionCandidates(Number(id)),
      ]);
      setPosition((posRes as any).data || posRes);
      setCandidates((candRes as any).data || candRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExisting = async () => {
    if (!selectedCandidateId) {
      message.warning('请选择候选人');
      return;
    }
    try {
      await addCandidateToPosition(Number(id), { candidateId: selectedCandidateId });
      message.success('添加成功');
      setAddExistingModalOpen(false);
      setSelectedCandidateId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message || '添加失败');
    }
  };

  const handleAIMatch = async (candidateId: number) => {
    try {
      setMatching(true);
      const res: any = await matchAnalysis(candidateId, Number(id));
      message.success('AI匹配分析完成');
      loadData();
    } catch (err: any) {
      message.error(err.message || '匹配分析失败');
    } finally {
      setMatching(false);
    }
  };

  // 打开编辑弹窗
  const handleEdit = async () => {
    if (!position) return;
    try {
      const res: any = await getProjects();
      setProjectList(res.data || res || []);
    } catch { /* ignore */ }
    editForm.setFieldsValue({
      systemName: position.systemName,
      department: position.department,
      requirementNumber: position.requirementNumber,
      projectId: position.projectId,
      positionType: position.positionType,
      positionDuty: position.positionDuty,
      techDomain: position.techDomain,
      majorType: position.majorType,
      levelDistribution: position.levelDistribution,
      salaryRange: position.salaryRange,
      requirements: position.requirements,
      responsibilities: position.responsibilities,
      domainExperience: position.domainExperience,
      region: position.region,
      deliveryForm: position.deliveryForm,
      urgency: position.urgency,
      headcount: position.requiredCount,
      expectedDate: position.expectedDate ? position.expectedDate.substring(0, 10) : undefined,
      positionImplementation: position.positionImplementation,
      status: position.status,
    });
    setEditModalOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await updatePosition(Number(id), {
        ...values,
        requiredCount: values.headcount,
      });
      message.success('保存成功');
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 判断当前用户是否是创建者或管理员
  const isCreator = user && position && (
    user.id === position.creatorId ||
    user.role === 'admin'
  );

  // 智能识别候选人文件
  const handleAnalyze = async () => {
    if (!importFile) {
      message.warning('请先上传文件');
      return;
    }
    try {
      setAnalyzing(true);
      const instruction = '请分析此文件中的候选人数据，建立字段映射关系。';
      const res: any = await analyzeFile(importFile, instruction);
      const data = res.data || res;

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setPreviewData(data.items);
        setSelectedRowKeys(data.items.map((_: any, i: number) => i));
        if (data.summary) {
          message.info(data.summary);
        }
        setImportStep(1);
      } else if (data.items && data.items.length === 0) {
        message.error(data.summary || 'AI 未识别到有效数据，请检查文件内容');
      } else {
        message.error(data.summary || 'AI 返回数据格式不正确');
      }
    } catch (err: any) {
      console.error('智能识别失败:', err);
      const errMsg = err?.response?.data?.summary || err?.response?.data?.message || err?.message || '智能识别失败';
      message.error(`智能识别失败: ${errMsg}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // 确认导入候选人
  const handleImport = async () => {
    const itemsToImport = selectedRowKeys.map((key) => previewData[key]).filter(Boolean);
    if (itemsToImport.length === 0) {
      message.warning('请至少选择一条候选人数据');
      return;
    }
    try {
      setImporting(true);
      const res: any = await batchImportCandidates(Number(id), itemsToImport);
      const result = res.data || res;
      message.success(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.errors && result.errors.length > 0) {
        Modal.warning({
          title: '部分导入失败',
          content: (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {result.errors.map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#666' }}>{e}</div>
              ))}
            </div>
          ),
        });
      }
      setImportModalOpen(false);
      resetImportState();
      loadData();
    } catch (err: any) {
      message.error(err?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const resetImportState = () => {
    setImportStep(0);
    setImportFile(null);
    setPreviewData([]);
    setSelectedRowKeys([]);
    setFilterKeyword('');
  };

  // 筛选后的预览数据
  const filteredPreview = previewData.filter((item) => {
    if (!filterKeyword) return true;
    const kw = filterKeyword.toLowerCase();
    return Object.values(item).some((v) => String(v).toLowerCase().includes(kw));
  });

  // 所有字段标签（候选人+岗位）
  const ALL_FIELD_LABELS: Record<string, string> = {
    name: '姓名', gender: '性别', idType: '证件类型', idNumber: '证件号码',
    contactPhone: '联系电话', contactEmail: '联系邮箱', areaCode: '区号',
    supplier: '供应商', educationType: '学历类型', education: '学历',
    graduationDate: '毕业时间', domainYears: '领域年限', workStatus: '工作状态',
    expectedSalary: '期望薪资', recommender: '推荐人', recommendReason: '推荐理由',
    systemName: '系统', department: '部门', requirementNumber: '需求编号',
    positionType: '岗位类型', positionDuty: '岗位职务', techDomain: '技术领域',
    majorType: '专业类型', levelDistribution: '职级分布', salaryRange: '薪资范围',
    region: '地区', deliveryForm: '交付形式',
  };

  // 优先显示的关键字段
  const PRIORITY_FIELDS = ['name', 'gender', 'contactPhone', 'idNumber', 'supplier', 'education', 'domainYears', 'workStatus', 'expectedSalary', 'recommender', 'requirementNumber', 'positionType', 'positionDuty', 'techDomain'];

  // 动态生成预览表格列：根据 AI 映射的数据中实际存在的字段
  const previewColumns = (() => {
    if (previewData.length === 0) return [];
    const sampleItem = previewData[0];
    const allKeys = Object.keys(sampleItem);
    // 排序：优先字段在前，其余按原始顺序
    const sortedKeys = [
      ...PRIORITY_FIELDS.filter((k) => allKeys.includes(k)),
      ...allKeys.filter((k) => !PRIORITY_FIELDS.includes(k)),
    ];
    return sortedKeys.map((key) => ({
      title: ALL_FIELD_LABELS[key] || key,
      dataIndex: key,
      key,
      width: key === 'idNumber' ? 160 : key === 'contactPhone' ? 120 : 100,
      ellipsis: true,
      render: (v: any) => v ?? '-',
    }));
  })();

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!position) return <div>岗位不存在</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回
      </Button>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card
          style={{ borderRadius: 8, flex: '1 1 400px', minWidth: 300 }}
          extra={isCreator ? (
            <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
          ) : null}
        >
          <Descriptions title={position.positionDuty} column={2}>
            <Descriptions.Item label="系统">{position.systemName || '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{position.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="需求编号">{position.requirementNumber || '-'}</Descriptions.Item>
            <Descriptions.Item label="所属项目">{position.project?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="岗位类型">{position.positionType || '-'}</Descriptions.Item>
            <Descriptions.Item label="岗位职务">{position.positionDuty || '-'}</Descriptions.Item>
            <Descriptions.Item label="技术领域">{position.techDomain || '-'}</Descriptions.Item>
            <Descriptions.Item label="专业类型">{position.majorType || '-'}</Descriptions.Item>
            <Descriptions.Item label="职级分布">{position.levelDistribution || '-'}</Descriptions.Item>
            <Descriptions.Item label="薪资范围">{position.salaryRange || '面议'}</Descriptions.Item>
            <Descriptions.Item label="地区">{position.region || '-'}</Descriptions.Item>
            <Descriptions.Item label="交付形式">{position.deliveryForm || '-'}</Descriptions.Item>
            <Descriptions.Item label="紧急程度">
              {({ low: '低', medium: '中', high: '高', critical: '紧急' } as any)[position.urgency] || position.urgency}
            </Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag status={position.status} type="position" /></Descriptions.Item>
            <Descriptions.Item label="需求/已推荐/已录用/缺口">
              {position.requiredCount || 0} / {candidates.length} / {position.hiredCount || 0} / {Math.max(0, (position.requiredCount || 0) - (position.hiredCount || 0))}
            </Descriptions.Item>
            <Descriptions.Item label="期望到岗日期">
              {position.expectedDate ? position.expectedDate.substring(0, 10) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="岗位要求" span={2}>{position.requirements || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="岗位职责" span={2}>{position.responsibilities || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="领域经验" span={2}>{position.domainExperience || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="岗位实施" span={2}>{position.positionImplementation || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="创建者">{position.creator?.name || position.creator?.username || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          title="候选人列表"
          style={{ borderRadius: 8, flex: '2 1 500px', minWidth: 400 }}
          extra={
            <Space>
              {selectedCpIds.length > 0 && (
                <Popconfirm
                  title={`确定移除选中的 ${selectedCpIds.length} 个候选人？`}
                  onConfirm={handleBatchRemove}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} loading={batchDeleting}>
                    批量移除 ({selectedCpIds.length})
                  </Button>
                </Popconfirm>
              )}
              <Button icon={<ImportOutlined />} onClick={() => { resetImportState(); setImportModalOpen(true); }}>
                导入候选人
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => setCandidateModalOpen(true)}>
                新建候选人
              </Button>
              <Button onClick={async () => {
                const { getCandidates } = await import('../api/candidate');
                const res: any = await getCandidates();
                setAllCandidates(res.data || res || []);
                setAddExistingModalOpen(true);
              }}>
                添加已有候选人
              </Button>
              <Button icon={<RobotOutlined />} type="primary" loading={matching} onClick={() => message.info('AI匹配分析将对所有候选人执行')}>
                AI匹配分析
              </Button>
            </Space>
          }
        >
          <Table
            dataSource={candidates}
            rowKey={(r: any) => r.id}
            pagination={false}
            locale={{ emptyText: '暂无候选人' }}
            rowSelection={{
              selectedRowKeys: selectedCpIds,
              onChange: (keys) => setSelectedCpIds(keys as number[]),
            }}
            columns={[
              {
                title: '姓名',
                key: 'candidateName',
                render: (_: any, record: any) => (
                  <a onClick={() => handleViewCandidate(record.candidateId || record.id)}>
                    {record.candidate?.name || record.candidateName || '-'}
                  </a>
                ),
              },
              {
                title: '联系电话',
                key: 'contactPhone',
                render: (_: any, record: any) => record.candidate?.contactPhone || record.contactPhone || '-',
              },
              {
                title: '供应商',
                key: 'supplier',
                render: (_: any, record: any) => record.candidate?.supplier || record.supplier || '-',
              },
              {
                title: '匹配分数',
                dataIndex: 'matchScore',
                key: 'matchScore',
                render: (v: number) => (v !== undefined && v !== null ? <MatchScoreTag score={v} /> : '-'),
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => <StatusTag status={v} type="candidate" />,
              },
              {
                title: '操作',
                key: 'action',
                render: (_: any, record: any) => (
                  <Space>
                    <a onClick={() => handleViewCandidate(record.candidateId || record.id)}>查看详情</a>
                    <a onClick={() => handleAIMatch(record.candidateId || record.id)}>AI匹配</a>
                    <Popconfirm
                      title={`确定移除候选人「${record.candidate?.name || record.candidateName || ''}」？`}
                      onConfirm={() => handleRemoveCandidate(record.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <a style={{ color: '#ff4d4f' }}>移除</a>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <CandidateModal
        open={candidateModalOpen}
        onClose={() => setCandidateModalOpen(false)}
        onSuccess={loadData}
        positionId={Number(id)}
      />

      <Modal
        title="添加已有候选人"
        open={addExistingModalOpen}
        onOk={handleAddExisting}
        onCancel={() => { setAddExistingModalOpen(false); setSelectedCandidateId(null); }}
      >
        <div style={{ marginTop: 16 }}>
          {allCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无可添加的候选人</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allCandidates.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCandidateId(c.id)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${selectedCandidateId === c.id ? '#1890ff' : '#d9d9d9'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: selectedCandidateId === c.id ? '#e6f7ff' : 'transparent',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span style={{ color: '#999', marginLeft: 12 }}>{c.contactPhone || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 导入候选人弹窗 */}
      <Modal
        title="导入候选人"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); resetImportState(); }}
        width={importStep === 1 ? 1000 : 520}
        footer={
          importStep === 0
            ? [
                <Button key="cancel" onClick={() => { setImportModalOpen(false); resetImportState(); }}>取消</Button>,
                <Button key="analyze" type="primary" loading={analyzing} onClick={handleAnalyze} icon={<RobotOutlined />}>
                  智能识别
                </Button>,
              ]
            : [
                <Button key="back" onClick={() => setImportStep(0)}>上一步</Button>,
                <Button key="cancel" onClick={() => { setImportModalOpen(false); resetImportState(); }}>取消</Button>,
                <Button key="import" type="primary" loading={importing} onClick={handleImport} icon={<ImportOutlined />}>
                  确认导入 ({selectedRowKeys.length}/{previewData.length})
                </Button>,
              ]
        }
      >
        <Steps current={importStep} size="small" style={{ marginBottom: 20 }}>
          <Steps.Step title="上传文件" />
          <Steps.Step title="预览并导入" />
        </Steps>

        {importStep === 0 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Upload
                beforeUpload={(file) => {
                  setImportFile(file);
                  return false;
                }}
                maxCount={1}
                accept=".xlsx,.xls,.csv"
                onRemove={() => setImportFile(null)}
                fileList={importFile ? [importFile as any] : []}
              >
                <Button icon={<UploadOutlined />}>选择Excel文件</Button>
              </Upload>
            </div>
            <div style={{ color: '#999', fontSize: 12 }}>
              支持 .xlsx、.xls、.csv 格式，AI 将自动识别文件中的候选人字段并映射到系统标准字段
            </div>
          </div>
        )}

        {importStep === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space>
                <Input
                  placeholder="按姓名/电话/供应商等筛选"
                  prefix={<SearchOutlined />}
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  style={{ width: 240 }}
                  allowClear
                />
                <Tag color="blue">共 {previewData.length} 条</Tag>
                <Tag color="green">已选 {selectedRowKeys.length} 条</Tag>
              </Space>
              <Space>
                <Button size="small" onClick={() => setSelectedRowKeys(filteredPreview.map((_, i) => previewData.indexOf(filteredPreview[i])))}>
                  全选当前筛选
                </Button>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>取消全选</Button>
              </Space>
            </div>
            <Table
              dataSource={filteredPreview}
              rowKey={(_, index) => previewData.indexOf(filteredPreview[index!])}
              columns={previewColumns}
              scroll={{ x: 900, y: 400 }}
              size="small"
              pagination={{ pageSize: 50, showSizeChanger: false }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as number[]),
              }}
            />
          </div>
        )}
      </Modal>

      {/* 编辑岗位弹窗 */}
      <Modal
        title="编辑岗位需求"
        open={editModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalOpen(false)}
        destroyOnClose
        width={720}
        confirmLoading={saving}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="systemName" label="系统" rules={[{ required: true, message: '请输入系统' }]}>
                <Input placeholder="请输入系统" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请输入部门' }]}>
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="requirementNumber" label="需求编号" rules={[{ required: true, message: '请输入需求编号' }]}>
                <Input placeholder="请输入需求编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: '请选择所属项目' }]}>
                <Select placeholder="请选择所属项目">
                  {projectList.map((p: any) => (
                    <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="positionType" label="岗位类型" rules={[{ required: true, message: '请输入岗位类型' }]}>
                <Input placeholder="请输入岗位类型" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="positionDuty" label="岗位职务" rules={[{ required: true, message: '请输入岗位职务' }]}>
                <Input placeholder="请输入岗位职务" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="techDomain" label="技术领域" rules={[{ required: true, message: '请输入技术领域' }]}>
                <Input placeholder="请输入技术领域" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="majorType" label="专业类型" rules={[{ required: true, message: '请输入专业类型' }]}>
                <Input placeholder="请输入专业类型" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="levelDistribution" label="职级分布" rules={[{ required: true, message: '请输入职级分布' }]}>
                <Input placeholder="请输入职级分布" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salaryRange" label="薪资范围">
                <Input placeholder="请输入薪资范围" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="requirements" label="岗位要求" rules={[{ required: true, message: '请输入岗位要求' }]}>
            <Input.TextArea rows={3} placeholder="请输入岗位要求" />
          </Form.Item>
          <Form.Item name="responsibilities" label="岗位职责" rules={[{ required: true, message: '请输入岗位职责' }]}>
            <Input.TextArea rows={3} placeholder="请输入岗位职责" />
          </Form.Item>
          <Form.Item name="domainExperience" label="领域经验" rules={[{ required: true, message: '请输入领域经验' }]}>
            <Input.TextArea rows={2} placeholder="请输入领域经验要求" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="region" label="地区" rules={[{ required: true, message: '请输入地区' }]}>
                <Input placeholder="请输入地区" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deliveryForm" label="交付形式" rules={[{ required: true, message: '请输入交付形式' }]}>
                <Input placeholder="请输入交付形式" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="urgency" label="紧急程度">
                <Select>
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="critical">紧急</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="headcount" label="需求人数">
                <Input placeholder="请输入需求人数" type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expectedDate" label="期望到岗日期">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="positionImplementation" label="岗位实施">
                <Input readOnly />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="open">开放</Select.Option>
              <Select.Option value="partial">部分到岗</Select.Option>
              <Select.Option value="filled">已满岗</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 候选人详情弹窗 */}
      <Modal
        title="候选人详情"
        open={candidateDetailOpen}
        onCancel={() => { setCandidateDetailOpen(false); setCandidateDetail(null); }}
        footer={null}
        width={720}
        destroyOnClose
      >
        {candidateDetailLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : candidateDetail ? (
          <div>
            <Descriptions title={candidateDetail.name} column={2} size="small" bordered>
              <Descriptions.Item label="性别">{candidateDetail.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="证件类型">{candidateDetail.idType || '-'}</Descriptions.Item>
              <Descriptions.Item label="证件号码">{candidateDetail.idNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{candidateDetail.contactPhone || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系邮箱">{candidateDetail.contactEmail || '-'}</Descriptions.Item>
              <Descriptions.Item label="区号">{candidateDetail.areaCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="供应商">{candidateDetail.supplier || '-'}</Descriptions.Item>
              <Descriptions.Item label="学历类型">{candidateDetail.educationType || '-'}</Descriptions.Item>
              <Descriptions.Item label="学历">{candidateDetail.education || '-'}</Descriptions.Item>
              <Descriptions.Item label="毕业时间">{candidateDetail.graduationDate ? candidateDetail.graduationDate.substring(0, 10) : '-'}</Descriptions.Item>
              <Descriptions.Item label="领域年限">{candidateDetail.domainYears != null ? `${candidateDetail.domainYears}年` : '-'}</Descriptions.Item>
              <Descriptions.Item label="工作状态">{candidateDetail.workStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="期望薪资">{candidateDetail.expectedSalary || '-'}</Descriptions.Item>
              <Descriptions.Item label="简历" span={2}>
                {candidateDetail.resumeUrl ? (
                  <a href={candidateDetail.resumeUrl} target="_blank" rel="noopener noreferrer">查看简历</a>
                ) : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ marginTop: 24 }}>
              关联岗位 ({candidateDetail.candidatePositions?.length || 0})
            </Divider>

            {candidateDetail.candidatePositions?.length > 0 ? (
              <Table
                dataSource={candidateDetail.candidatePositions}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '项目',
                    key: 'project',
                    render: (_: any, record: any) => record.position?.project?.name || '-',
                  },
                  {
                    title: '需求编号',
                    key: 'requirementNumber',
                    render: (_: any, record: any) => record.position?.requirementNumber || '-',
                  },
                  {
                    title: '岗位职务',
                    key: 'positionDuty',
                    render: (_: any, record: any) => (
                      <a onClick={() => navigate(`/positions/${record.positionId}`)}>
                        {record.position?.positionDuty || '-'}
                      </a>
                    ),
                  },
                  {
                    title: '岗位类型',
                    key: 'positionType',
                    render: (_: any, record: any) => record.position?.positionType || '-',
                  },
                  {
                    title: '技术领域',
                    key: 'techDomain',
                    render: (_: any, record: any) => record.position?.techDomain || '-',
                  },
                  {
                    title: '推荐人',
                    dataIndex: 'recommender',
                    key: 'recommender',
                    render: (v: string) => v || '-',
                  },
                  {
                    title: '推送日期',
                    dataIndex: 'pushDate',
                    key: 'pushDate',
                    render: (v: string) => v ? v.substring(0, 10) : '-',
                  },
                  {
                    title: '简历',
                    dataIndex: 'resumeUrl',
                    key: 'resumeUrl',
                    render: (v: string) => v ? <a href={v} target="_blank" rel="noopener noreferrer">查看</a> : '-',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v: string) => <StatusTag status={v} type="candidate" />,
                  },
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>暂无关联岗位</div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
