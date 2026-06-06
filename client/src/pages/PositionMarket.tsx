import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Input, Select, Button, Tag, Space, Spin, Empty, Modal, Form, message, Table, Upload, Steps } from 'antd';
import { SearchOutlined, PlusOutlined, DollarOutlined, TeamOutlined, ClockCircleOutlined, EnvironmentOutlined, ImportOutlined, UploadOutlined, CheckOutlined } from '@ant-design/icons';
import { getPositions, createPosition, batchImportPositions } from '../api/position';
import { getProjects } from '../api/project';
import { analyzeFile } from '../api/ai';
import { useUserStore } from '../stores/user';
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

const IMPORT_FIELDS = [
  'systemName', 'department', 'requirementNumber', 'positionType', 'positionDuty',
  'techDomain', 'majorType', 'levelDistribution', 'salaryRange', 'requirements',
  'responsibilities', 'domainExperience', 'region', 'deliveryForm', 'urgency',
  'headcount', 'expectedDate', 'positionImplementation',
];

const FIELD_LABELS: Record<string, string> = {
  systemName: '系统', department: '部门', requirementNumber: '需求编号',
  positionType: '岗位类型', positionDuty: '岗位职务', techDomain: '技术领域',
  majorType: '专业类型', levelDistribution: '职级分布', salaryRange: '薪资范围',
  requirements: '岗位要求', responsibilities: '岗位职责', domainExperience: '领域经验',
  region: '地区', deliveryForm: '交付形式', urgency: '紧急程度',
  headcount: '需求人数', expectedDate: '期望到岗日期', positionImplementation: '岗位实施',
};

export default function PositionMarket() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [positions, setPositions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [filterProject, setFilterProject] = useState<number | undefined>();
  const [filterUrgency, setFilterUrgency] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 导入相关状态
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProjectId, setImportProjectId] = useState<number | undefined>();
  const [analyzing, setAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

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

  // 智能识别
  const handleAnalyze = async () => {
    if (!importFile || !importProjectId) {
      message.warning('请先上传文件并选择目标项目');
      return;
    }
    try {
      setAnalyzing(true);
      const instruction = '请分析此文件中的岗位数据，建立字段映射关系。';
      const res: any = await analyzeFile(importFile, instruction);
      const data = res.data || res;

      // 后端返回 { type, items, fieldMapping, unmappedFields, summary }
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        // 后端已用 fieldMapping 映射好了，直接使用
        setPreviewData(data.items);
        if (data.summary) {
          message.info(data.summary);
        }
        setImportStep(1);
      } else if (data.items && data.items.length === 0) {
        message.error(data.summary || 'AI 未识别到有效数据，请检查文件内容');
      } else if (typeof data === 'string') {
        // 兼容：AI 直接返回 JSON 字符串
        try {
          const jsonMatch = data.match(/\[[\s\S]*\]/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : data);
          if (Array.isArray(parsed)) {
            setPreviewData(parsed);
            setImportStep(1);
          } else {
            message.error('AI 返回数据格式不正确');
          }
        } catch {
          message.error('AI 返回数据解析失败');
        }
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

  // 确认导入
  const handleImport = async () => {
    if (!importProjectId) {
      message.warning('请选择目标项目');
      return;
    }
    try {
      setImporting(true);
      const res: any = await batchImportPositions({
        items: previewData,
        projectId: importProjectId,
      });
      const result = res.data || res;
      message.success(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.errors && result.errors.length > 0) {
        Modal.warning({
          title: '部分导入失败',
          content: (
            <div>
              {result.errors.map((e: string, i: number) => (
                <div key={i}>{e}</div>
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
    setImportProjectId(undefined);
    setPreviewData([]);
  };

  const openImportModal = () => {
    resetImportState();
    setImportModalOpen(true);
  };

  // 预览表格列
  const previewColumns = IMPORT_FIELDS.map((field) => ({
    title: FIELD_LABELS[field] || field,
    dataIndex: field,
    key: field,
    width: 120,
    ellipsis: true,
    render: (text: any) => text ?? '-',
  }));

  const filtered = positions.filter((p) => {
    if (keyword && !(p.positionDuty || '').includes(keyword) && !(p.requirementNumber || '').includes(keyword) && !(p.project?.name || '').includes(keyword)) return false;
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
            placeholder="搜索岗位职务/需求编号/项目"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 260 }}
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
            <Select.Option value="partial">部分到岗</Select.Option>
            <Select.Option value="filled">已满员</Select.Option>
            <Select.Option value="closed">已关闭</Select.Option>
          </Select>
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </Space>
        <Space>
          <Button icon={<ImportOutlined />} onClick={openImportModal}>
            导入岗位
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ positionImplementation: user?.name || user?.username || '' }); setCreateModalOpen(true); }}>
            发布岗位需求
          </Button>
        </Space>
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
                    <h3 style={{ margin: 0, fontSize: 16, flex: 1, marginRight: 8 }}>{pos.positionDuty}</h3>
                    <Tag color={urgencyColorMap[pos.urgency] || 'default'}>
                      {urgencyLabelMap[pos.urgency] || pos.urgency}
                    </Tag>
                  </div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 6 }}>
                    {pos.project?.name || '未知项目'} · {pos.department}
                  </div>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 6 }}>
                    {pos.systemName} · {pos.requirementNumber}
                  </div>
                  {pos.salaryRange && (
                    <div style={{ marginBottom: 6, color: '#fa8c16', fontWeight: 500 }}>
                      <DollarOutlined style={{ marginRight: 4 }} />
                      {pos.salaryRange}
                    </div>
                  )}
                  <div style={{ marginBottom: 6, fontSize: 13, color: '#595959' }}>
                    <EnvironmentOutlined style={{ marginRight: 4 }} />
                    {pos.region} · {pos.deliveryForm}
                  </div>
                  <div style={{ marginBottom: 6, fontSize: 13, color: '#595959' }}>
                    <TeamOutlined style={{ marginRight: 4 }} />
                    需求 {pos.requiredCount || 0} 人 / 已推荐 {pos.recommendedCount || 0} 人 / 已录用 {pos.hiredCount || 0} 人
                    {pos.gapCount > 0 && (
                      <Tag color="volcano" style={{ marginLeft: 6, fontSize: 11 }}>还差 {pos.gapCount} 人</Tag>
                    )}
                    {pos.gapCount === 0 && pos.requiredCount > 0 && (
                      <Tag color="green" style={{ marginLeft: 6, fontSize: 11 }}>已满员</Tag>
                    )}
                  </div>
                  {pos.expectedDate && (
                    <div style={{ marginBottom: 6, fontSize: 13, color: '#595959' }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      期望到岗: {pos.expectedDate.substring(0, 10)}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Tag>{pos.positionType}</Tag>
                    <Tag color="blue">{pos.techDomain}</Tag>
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
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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
                  {projects.map((p) => (
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
                <Input placeholder="请输入技术领域，如：Java、前端、AI" />
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
                <Input placeholder="请输入职级分布，如：P6-P7" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salaryRange" label="薪资范围">
                <Input placeholder="请输入薪资范围，如：15K-25K" />
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
                <Input placeholder="请输入地区，如：北京、上海" />
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
              <Form.Item name="urgency" label="紧急程度" initialValue="medium">
                <Select>
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="critical">紧急</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="headcount" label="需求人数" initialValue={1}>
                <Input placeholder="请输入需求人数" type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="expectedDate" label="期望到岗日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="positionImplementation" label="岗位实施">
            <Input placeholder="自动识别" readOnly />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入岗位弹窗 */}
      <Modal
        title="导入岗位"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); resetImportState(); }}
        width={900}
        footer={importStep === 0 ? [
          <Button key="cancel" onClick={() => { setImportModalOpen(false); resetImportState(); }}>取消</Button>,
          <Button key="analyze" type="primary" icon={<SearchOutlined />} loading={analyzing} onClick={handleAnalyze}>
            智能识别
          </Button>,
        ] : [
          <Button key="back" onClick={() => setImportStep(0)}>上一步</Button>,
          <Button key="import" type="primary" icon={<CheckOutlined />} loading={importing} onClick={handleImport}>
            确认导入
          </Button>,
        ]}
        destroyOnClose
      >
        <Steps
          current={importStep}
          items={[{ title: '上传文件' }, { title: '预览确认' }]}
          style={{ marginBottom: 24 }}
        />

        {importStep === 0 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>上传 Excel 文件</div>
              <Upload
                accept=".xlsx,.xls,.csv"
                maxCount={1}
                beforeUpload={(file) => {
                  setImportFile(file);
                  return false;
                }}
                onRemove={() => setImportFile(null)}
                fileList={importFile ? [importFile as any] : []}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </div>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>选择目标项目</div>
              <Select
                placeholder="请选择目标项目"
                value={importProjectId}
                onChange={setImportProjectId}
                style={{ width: '100%' }}
              >
                {projects.map((p) => (
                  <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {importStep === 1 && (
          <div>
            <div style={{ marginBottom: 12, color: '#8c8c8c' }}>
              AI 已识别 {previewData.length} 条岗位数据，请检查后确认导入：
            </div>
            <Table
              dataSource={previewData.map((item, idx) => ({ ...item, _key: idx }))}
              columns={previewColumns}
              rowKey="_key"
              scroll={{ x: 1800 }}
              size="small"
              pagination={{ pageSize: 5 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
