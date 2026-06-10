import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table, Input, Button, Space, Tag, Select, Badge, Modal, Checkbox, Descriptions, Divider, Spin, message,
} from 'antd';
import {
  SearchOutlined, UserOutlined, DownOutlined, RightOutlined, ExportOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  getCandidatesGrouped, updateCandidatePositionStatus, getCandidate,
} from '../api/candidate';
import { getPositions } from '../api/position';
import { getProjects } from '../api/project';
import StatusTag from '../components/StatusTag';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_screen: { label: '待筛选', color: 'default' },
  screen_rejected: { label: '筛选不通过', color: 'red' },
  screen_passed: { label: '筛选通过待约面', color: 'blue' },
  pending_interview: { label: '待面试', color: 'orange' },
  interview_passed: { label: '面试通过', color: 'green' },
  interview_rejected: { label: '面试不通过', color: 'volcano' },
  abandoned: { label: '放弃面试', color: 'default' },
  pending_onboard: { label: '待入职', color: 'cyan' },
  onboarded: { label: '已入职', color: 'geekblue' },
};

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, { label }]) => ({
  value,
  label,
}));

// 导出字段定义
interface ExportField {
  key: string;
  label: string;
  group: 'candidate' | 'position'; // candidate字段同一人只显示一次，position字段每行都显示
}

const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  { key: 'name', label: '姓名', group: 'candidate' },
  { key: 'gender', label: '性别', group: 'candidate' },
  { key: 'idType', label: '证件类型', group: 'candidate' },
  { key: 'idNumber', label: '证件号码', group: 'candidate' },
  { key: 'contactPhone', label: '联系电话', group: 'candidate' },
  { key: 'contactEmail', label: '联系邮箱', group: 'candidate' },
  { key: 'supplier', label: '供应商', group: 'candidate' },
  { key: 'educationType', label: '学历类型', group: 'candidate' },
  { key: 'education', label: '学历', group: 'candidate' },
  { key: 'domainYears', label: '领域年限', group: 'candidate' },
  { key: 'workStatus', label: '工作状态', group: 'candidate' },
  { key: 'expectedSalary', label: '期望薪资', group: 'candidate' },
  { key: 'resumeUrl', label: '简历', group: 'candidate' },
  { key: 'projectName', label: '项目', group: 'position' },
  { key: 'requirementNumber', label: '需求编号', group: 'position' },
  { key: 'positionType', label: '岗位类型', group: 'position' },
  { key: 'positionTitle', label: '岗位职务', group: 'position' },
  { key: 'techDomain', label: '技术领域', group: 'position' },
  { key: 'implementation', label: '对接实施', group: 'position' },
  { key: 'recommender', label: '推荐人', group: 'position' },
  { key: 'pushDate', label: '推送日期', group: 'position' },
  { key: 'status', label: '状态', group: 'position' },
];

const STORAGE_KEY = 'candidate_export_field_order';

function loadSavedFields(): { fields: ExportField[]; checkedKeys: string[] } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 确保所有默认字段都存在（处理新增字段）
      const savedKeys = new Set(parsed.fields.map((f: ExportField) => f.key));
      const allFields = [
        ...parsed.fields,
        ...DEFAULT_EXPORT_FIELDS.filter((f) => !savedKeys.has(f.key)),
      ];
      return { fields: allFields, checkedKeys: parsed.checkedKeys || allFields.map((f: ExportField) => f.key) };
    }
  } catch { /* ignore */ }
  return { fields: DEFAULT_EXPORT_FIELDS, checkedKeys: DEFAULT_EXPORT_FIELDS.map((f) => f.key) };
}

function saveFields(fields: ExportField[], checkedKeys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ fields, checkedKeys }));
}

// 获取字段值的辅助函数
function getFieldValue(group: any, pos: any, field: ExportField, idx: number): any {
  const { key, group: fieldGroup } = field;
  if (fieldGroup === 'candidate') {
    const val = group[key];
    if (key === 'domainYears') return idx === 0 ? (val ?? '') : '';
    return idx === 0 ? (val || '') : '';
  }
  // position 字段
  if (key === 'status') return STATUS_MAP[pos.status]?.label || pos.status;
  if (key === 'pushDate') return pos.pushDate ? pos.pushDate.substring(0, 10) : '';
  return pos[key] || '';
}

export default function CandidateList() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>();
  const [filterPositionId, setFilterPositionId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [projects, setProjects] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // 候选人详情弹窗
  const [candidateDetailOpen, setCandidateDetailOpen] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);

  const handleViewCandidate = async (candidateId: number) => {
    try {
      setCandidateDetailLoading(true);
      setCandidateDetailOpen(true);
      const res: any = await getCandidate(candidateId);
      const data = res.data || res;
      setCandidateDetail(data);
    } catch {
      message.error('获取候选人详情失败');
    } finally {
      setCandidateDetailLoading(false);
    }
  };

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportField[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    const saved = loadSavedFields();
    setExportFields(saved.fields);
    setCheckedKeys(saved.checkedKeys);
  }, []);

  useEffect(() => {
    getProjects().then((res: any) => setProjects(res.data || res || []));
    getPositions().then((res: any) => setPositions(res.data || res || []));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await getCandidatesGrouped({
        keyword: keyword || undefined,
        projectId: filterProjectId,
        positionId: filterPositionId,
        status: filterStatus,
      });
      setGroups(res.data || res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [keyword, filterProjectId, filterPositionId, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (cpId: number, newStatus: string) => {
    try {
      await updateCandidatePositionStatus(cpId, newStatus);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  // 导出字段排序
  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...exportFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setExportFields(newFields);
  };

  // 拖拽排序
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newFields = [...exportFields];
    const dragIdx = dragItem.current;
    const overIdx = dragOverItem.current;
    const [removed] = newFields.splice(dragIdx, 1);
    newFields.splice(overIdx, 0, removed);
    setExportFields(newFields);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // 确认导出
  const handleConfirmExport = () => {
    const activeFields = exportFields.filter((f) => checkedKeys.includes(f.key));
    if (activeFields.length === 0) return;

    const rows: Record<string, any>[] = [];
    groups.forEach((group: any) => {
      group.positions.forEach((pos: any, idx: number) => {
        const row: Record<string, any> = {};
        activeFields.forEach((field) => {
          row[field.label] = getFieldValue(group, pos, field, idx);
        });
        rows.push(row);
      });
      if (group.positions.length === 0) {
        const row: Record<string, any> = {};
        activeFields.forEach((field) => {
          if (field.group === 'candidate') {
            const val = group[field.key];
            row[field.label] = field.key === 'domainYears' ? (val ?? '') : (val || '');
          } else {
            row[field.label] = '';
          }
        });
        rows.push(row);
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '候选人列表');
    XLSX.writeFile(wb, `候选人列表_${new Date().toISOString().slice(0, 10)}.xlsx`);

    // 保存字段顺序和勾选状态
    saveFields(exportFields, checkedKeys);
    setExportModalOpen(false);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredPositions = filterProjectId
    ? positions.filter((p: any) => p.projectId === filterProjectId)
    : positions;

  const handleExportCSV = () => {
    const headers = ['姓名', '性别', '证件类型', '证件号码', '联系电话', '联系邮箱', '供应商', '学历类型', '学历', '领域年限', '工作状态', '期望薪资', '项目', '需求编号', '岗位类型', '岗位职务', '技术领域', '对接实施', '推荐人', '推送日期', '状态'];
    const keys = ['name', 'gender', 'idType', 'idNumber', 'contactPhone', 'contactEmail', 'supplier', 'educationType', 'education', 'domainYears', 'workStatus', 'expectedSalary', 'projectName', 'requirementNumber', 'positionType', 'positionTitle', 'techDomain', 'implementation', 'recommender', 'pushDate', 'status'];

    const rows: string[][] = [];
    groups.forEach((group: any) => {
      if (group.positions.length === 0) {
        const row: string[] = keys.map((key, idx) => {
          if (idx < 12) {
            const val = group[key];
            return key === 'domainYears' ? (val ?? '') : (val || '');
          }
          return '';
        });
        rows.push(row);
      } else {
        group.positions.forEach((pos: any, idx: number) => {
          const row: string[] = keys.map((key, colIdx) => {
            if (colIdx < 12) {
              if (idx > 0) return '';
              const val = group[key];
              return key === 'domainYears' ? (val ?? '') : (val || '');
            }
            if (key === 'status') return STATUS_MAP[pos.status]?.label || pos.status || '';
            if (key === 'pushDate') return pos.pushDate ? pos.pushDate.substring(0, 10) : '';
            return pos[key] || '';
          });
          rows.push(row);
        });
      }
    });

    const csvContent = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `候选人列表_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportResumes = async () => {
    try {
      message.loading({ content: '正在打包简历文件...', key: 'exportResumes', duration: 0 });
      const params = new URLSearchParams();
      if (filterProjectId) params.append('projectId', String(filterProjectId));
      if (filterPositionId) params.append('positionId', String(filterPositionId));
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/candidates/export-resumes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        message.error({ content: data.message || '导出失败', key: 'exportResumes' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `候选人简历_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      message.success({ content: '简历文件导出成功', key: 'exportResumes' });
    } catch {
      message.error({ content: '导出简历文件失败', key: 'exportResumes' });
    }
  };

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder="搜索姓名/电话/证件号"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="筛选项目"
          value={filterProjectId}
          onChange={(v) => { setFilterProjectId(v); setFilterPositionId(undefined); }}
          allowClear
          style={{ width: 160 }}
          options={projects.map((p: any) => ({ value: p.id, label: p.name }))}
        />
        <Select
          placeholder="筛选岗位"
          value={filterPositionId}
          onChange={setFilterPositionId}
          allowClear
          style={{ width: 180 }}
          options={filteredPositions.map((p: any) => ({ value: p.id, label: p.positionDuty }))}
        />
        <Select
          placeholder="筛选状态"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 160 }}
          options={STATUS_OPTIONS}
        />
        <Button onClick={() => { setKeyword(''); setFilterProjectId(undefined); setFilterPositionId(undefined); setFilterStatus(undefined); }}>
          重置筛选
        </Button>
        <Button type="primary" icon={<ExportOutlined />} onClick={() => setExportModalOpen(true)} disabled={groups.length === 0}>
          导出Excel
        </Button>
        <Button icon={<ExportOutlined />} onClick={handleExportCSV} disabled={groups.length === 0}>
          导出CSV
        </Button>
        <Button icon={<ExportOutlined />} onClick={handleExportResumes} disabled={groups.length === 0}>
          导出简历文件
        </Button>
      </div>

      {/* 导出配置弹窗 */}
      <Modal
        title="导出候选人数据"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setExportModalOpen(false)}>取消</Button>,
          <Button key="reset" onClick={() => { setExportFields(DEFAULT_EXPORT_FIELDS); setCheckedKeys(DEFAULT_EXPORT_FIELDS.map((f) => f.key)); }}>恢复默认</Button>,
          <Button key="export" type="primary" onClick={handleConfirmExport} disabled={checkedKeys.length === 0}>
            确认导出
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
          拖拽或使用箭头调整字段顺序，勾选需要导出的字段。调整后的顺序将自动保存。
        </div>
        <div style={{ marginBottom: 8 }}>
          <Checkbox
            checked={checkedKeys.length === exportFields.length}
            indeterminate={checkedKeys.length > 0 && checkedKeys.length < exportFields.length}
            onChange={(e) => setCheckedKeys(e.target.checked ? exportFields.map((f) => f.key) : [])}
          >
            全选
          </Checkbox>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {exportFields.map((field, index) => (
            <div
              key={field.key}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderBottom: '1px solid #f5f5f5',
                background: '#fff',
                cursor: 'grab',
                transition: 'background 0.2s',
              }}
            >
              <Checkbox
                checked={checkedKeys.includes(field.key)}
                onChange={(e) => {
                  setCheckedKeys(e.target.checked
                    ? [...checkedKeys, field.key]
                    : checkedKeys.filter((k) => k !== field.key));
                }}
              />
              <span style={{ flex: 1, marginLeft: 8, fontSize: 14 }}>
                {field.label}
                <Tag color={field.group === 'candidate' ? 'blue' : 'green'} style={{ marginLeft: 8, fontSize: 11 }}>
                  {field.group === 'candidate' ? '候选人' : '岗位'}
                </Tag>
              </span>
              <Space size={4}>
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => moveField(index, 'up')}
                  type="text"
                />
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === exportFields.length - 1}
                  onClick={() => moveField(index, 'down')}
                  type="text"
                />
              </Space>
            </div>
          ))}
        </div>
      </Modal>

      {/* 候选人分组列表 */}
      <Table
        dataSource={groups}
        rowKey={(r) => `${r.name}_${r.contactPhone || r.phone}`}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 人` }}
        scroll={{ x: 1600 }}
        columns={[
          {
            title: '候选人',
            key: 'candidate',
            width: 180,
            fixed: 'left' as const,
            render: (_: any, record: any) => {
              const key = `${record.name}_${record.contactPhone || record.phone}`;
              const isExpanded = expandedKeys.has(key);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isExpanded ? <DownOutlined style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => toggleExpand(key)} /> : <RightOutlined style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => toggleExpand(key)} />}
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <a onClick={() => handleViewCandidate(record.candidateIds?.[0])} style={{ fontWeight: 500 }}>{record.name}</a>
                  <Badge count={record.positions.length} style={{ marginLeft: 4 }} />
                </div>
              );
            },
          },
          { title: '性别', dataIndex: 'gender', width: 60, render: (v: string) => v || '-' },
          { title: '证件类型', dataIndex: 'idType', width: 90, render: (v: string) => v || '-' },
          { title: '证件号码', dataIndex: 'idNumber', width: 160, render: (v: string) => v || '-' },
          { title: '联系电话', dataIndex: 'contactPhone', width: 120, render: (v: string) => v || '-' },
          { title: '联系邮箱', dataIndex: 'contactEmail', width: 160, render: (v: string) => v || '-' },
          { title: '供应商', dataIndex: 'supplier', width: 100, render: (v: string) => v || '-' },
          { title: '学历类型', dataIndex: 'educationType', width: 80, render: (v: string) => v || '-' },
          { title: '学历', dataIndex: 'education', width: 60, render: (v: string) => v || '-' },
          { title: '领域年限', dataIndex: 'domainYears', width: 80, render: (v: number) => v ?? '-' },
          { title: '工作状态', dataIndex: 'workStatus', width: 80, render: (v: string) => v || '-' },
          { title: '期望薪资', dataIndex: 'expectedSalary', width: 100, render: (v: string) => v || '-' },
          {
            title: '关联岗位数',
            key: 'positionCount',
            width: 90,
            render: (_: any, record: any) => record.positions.length,
          },
          {
            title: '最新状态',
            key: 'latestStatus',
            width: 120,
            render: (_: any, record: any) => {
              const latest = record.positions[0];
              if (!latest) return '-';
              const s = STATUS_MAP[latest.status];
              return s ? <Tag color={s.color}>{s.label}</Tag> : latest.status;
            },
          },
        ]}
        expandable={{
          expandedRowKeys: [...expandedKeys],
          onExpandedRowsChange: (keys) => {
            setExpandedKeys(new Set(keys as string[]));
          },
          expandedRowRender: (record: any) => (
            <Table
              dataSource={record.positions}
              rowKey="cpId"
              size="small"
              pagination={false}
              scroll={{ x: 1400 }}
              columns={[
                {
                  title: '项目',
                  key: 'projectName',
                  width: 120,
                  render: (_: any, pos: any) => pos.projectName || '-',
                },
                {
                  title: '需求编号',
                  key: 'requirementNumber',
                  width: 100,
                  render: (_: any, pos: any) => pos.requirementNumber || '-',
                },
                {
                  title: '岗位类型',
                  key: 'positionType',
                  width: 80,
                  render: (_: any, pos: any) => pos.positionType || '-',
                },
                {
                  title: '岗位职务',
                  key: 'positionTitle',
                  width: 120,
                  render: (_: any, pos: any) => pos.positionTitle || '-',
                },
                {
                  title: '技术领域',
                  key: 'techDomain',
                  width: 100,
                  render: (_: any, pos: any) => pos.techDomain || '-',
                },
                {
                  title: '对接实施',
                  key: 'implementation',
                  width: 100,
                  render: (_: any, pos: any) => pos.implementation || '-',
                },
                {
                  title: '推荐人',
                  key: 'recommender',
                  width: 80,
                  render: (_: any, pos: any) => pos.recommender || '-',
                },
                {
                  title: '推送日期',
                  key: 'pushDate',
                  width: 100,
                  render: (_: any, pos: any) => pos.pushDate ? pos.pushDate.substring(0, 10) : '-',
                },
                {
                  title: '简历',
                  key: 'resumeUrl',
                  width: 80,
                  render: (_: any, pos: any) => pos.resumeUrl ? <a href={pos.resumeUrl} target="_blank" rel="noopener noreferrer">查看</a> : '-',
                },
                {
                  title: '状态',
                  key: 'status',
                  width: 160,
                  render: (_: any, pos: any) => (
                    <Select
                      value={pos.status}
                      onChange={(v) => handleStatusChange(pos.cpId, v)}
                      style={{ width: 150 }}
                      size="small"
                      options={STATUS_OPTIONS}
                    />
                  ),
                },
              ]}
            />
          ),
        }}
      />

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
                    render: (_: any, record: any) => record.position?.positionDuty || '-',
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
