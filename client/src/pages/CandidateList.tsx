import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table, Input, Button, Space, Tag, Select, Badge, Modal, Checkbox, Descriptions, Divider, Spin, message, Form, DatePicker, Segmented, Tooltip, Steps,
} from 'antd';
import {
  SearchOutlined, UserOutlined, DownOutlined, RightOutlined, ExportOutlined,
  ArrowUpOutlined, ArrowDownOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  getCandidatesGrouped, getCandidatesList, updateCandidatePositionStatus, getCandidate,
} from '../api/candidate';
import { createInterview } from '../api/interview';
import { getPositions } from '../api/position';
import { getProjects } from '../api/project';
import StatusTag from '../components/StatusTag';
import MatchScoreTag from '../components/MatchScoreTag';

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
  const [flatList, setFlatList] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('list');
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>();
  const [filterPositionId, setFilterPositionId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [projects, setProjects] = useState<any[]>([]);

  // 列表视图：列顺序和筛选（仅本地，仅自己可见）
  const LIST_COL_ORDER_KEY = 'candidate_list_col_order';
  const LIST_FILTERS_KEY = 'candidate_list_filters';
  const DEFAULT_COL_ORDER = ['recommender', 'pushDate', 'projectPosition', 'department', 'candidateName', 'resumeUrl', 'matchScore', 'status', 'recommendReason', 'implementation', 'remark'];
  const [listColOrder, setListColOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem(LIST_COL_ORDER_KEY); if (s) return JSON.parse(s); } catch {}
    return DEFAULT_COL_ORDER;
  });
  const [listFilters, setListFilters] = useState<Record<string, string[]>>(() => {
    try {
      const s = localStorage.getItem(LIST_FILTERS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        // 兼容旧格式：仅保留数组类型的筛选值
        const valid: Record<string, string[]> = {};
        Object.entries(parsed).forEach(([k, v]) => { if (Array.isArray(v) && v.length) valid[k] = v; });
        return valid;
      }
    } catch {}
    return {};
  });

  const saveColOrder = (order: string[]) => { setListColOrder(order); localStorage.setItem(LIST_COL_ORDER_KEY, JSON.stringify(order)); };
  const saveFilters = (filters: Record<string, string[]>) => {
    setListFilters(filters);
    localStorage.setItem(LIST_FILTERS_KEY, JSON.stringify(filters));
  };

  // 拖拽排序辅助函数
  const dragColKey = useRef<string | null>(null);
  const dragOverColKey = useRef<string | null>(null);
  const makeDraggableHeader = (colKey: string) => ({
    colKey,
    draggable: true,
    onDragStart: () => { dragColKey.current = colKey; },
    onDragOver: (e: any) => { e.preventDefault(); dragOverColKey.current = colKey; },
    onDrop: () => {
      const from = dragColKey.current;
      const to = dragOverColKey.current;
      if (from && to && from !== to) {
        const newOrder = [...listColOrder];
        const fromIdx = newOrder.indexOf(from);
        const toIdx = newOrder.indexOf(to);
        if (fromIdx >= 0 && toIdx >= 0) {
          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, from);
          saveColOrder(newOrder);
        }
      }
      dragColKey.current = null;
      dragOverColKey.current = null;
    },
    style: { cursor: 'move' },
  } as any);

  // 列表视图：各列取显示值（用于生成筛选选项和匹配）
  const colValueGetters: Record<string, (r: any) => string> = {
    recommender: (r) => r.recommender || '(空)',
    pushDate: (r) => (r.pushDate ? r.pushDate.substring(0, 10) : (r.recommendedAt ? r.recommendedAt.substring(0, 10) : '(空)')),
    projectPosition: (r) => (r.projectName && r.positionDuty ? `${r.projectName} / ${r.positionDuty}` : (r.projectName || r.positionDuty || '(空)')),
    department: (r) => r.department || '(空)',
    candidateName: (r) => r.candidateName || '(空)',
    status: (r) => STATUS_MAP[r.status]?.label || r.status || '(空)',
    recommendReason: (r) => r.recommendReason || '(空)',
    implementation: (r) => r.implementation || '(空)',
  };

  // 从当前数据提取某列的不重复值，生成筛选选项
  const getFilterOptions = (colKey: string) => {
    const getter = colValueGetters[colKey];
    if (!getter) return [];
    const unique = Array.from(new Set(flatList.map(getter)));
    return unique.map((v) => ({ text: v, value: v }));
  };

  // 列表视图：按勾选值筛选数据（多列为"且"关系，列内为"或"关系）
  const filteredFlatList = flatList.filter((item: any) => {
    for (const [key, selected] of Object.entries(listFilters)) {
      if (!selected || !selected.length) continue;
      const getter = colValueGetters[key];
      if (!getter) continue;
      if (!selected.includes(getter(item))) return false;
    }
    return true;
  });

  // 生成带筛选和拖拽的列
  const buildListColumns = () => {
    const allCols: any[] = [
      { title: '上传招聘', key: 'recommender', width: 100, fixed: 'left' as const,
        render: (_: any, record: any) => (
          <a onClick={() => { setRecommenderName(record.recommender || '未知'); setRecommenderModalOpen(true); const filtered = flatList.filter((item: any) => item.recommender === record.recommender); setRecommenderList(filtered); }}>
            {record.recommender || '-'}
          </a>
        ),
        onHeaderCell: () => makeDraggableHeader('recommender'),
      },
      { title: '推荐日期', key: 'pushDate', width: 110,
        render: (_: any, record: any) => record.pushDate ? record.pushDate.substring(0, 10) : (record.recommendedAt ? record.recommendedAt.substring(0, 10) : '-'),
        onHeaderCell: () => makeDraggableHeader('pushDate'),
      },
      { title: '推荐项目及岗位', key: 'projectPosition', width: 200,
        render: (_: any, record: any) => (<div><div style={{ fontWeight: 500 }}>{record.projectName || '-'}</div><div style={{ color: '#666', fontSize: 12 }}>{record.positionDuty || '-'}</div></div>),
        onHeaderCell: () => makeDraggableHeader('projectPosition'),
      },
      { title: '岗位部门', dataIndex: 'department', key: 'department', width: 120, ellipsis: true,
        render: (v: string) => v || '-',
        onHeaderCell: () => makeDraggableHeader('department'),
      },
      { title: '姓名', key: 'candidateName', width: 100,
        render: (_: any, record: any) => (<a onClick={() => handleViewCandidate(record.candidateId)}>{record.candidateName}</a>),
        onHeaderCell: () => makeDraggableHeader('candidateName'),
      },
      { title: '简历', key: 'resumeUrl', width: 70,
        render: (_: any, record: any) => record.resumeUrl ? (<a href={record.resumeUrl} target="_blank" rel="noopener noreferrer"><FilePdfOutlined style={{ fontSize: 18, color: '#1890ff' }} /></a>) : '-',
        onHeaderCell: () => makeDraggableHeader('resumeUrl'),
      },
      { title: '分数', key: 'matchScore', width: 80,
        render: (_: any, record: any) => record.matchScore > 0 ? <MatchScoreTag score={record.matchScore} /> : '-',
        onHeaderCell: () => makeDraggableHeader('matchScore'),
      },
      { title: '状态', key: 'status', width: 120,
        render: (_: any, record: any) => (<Select value={record.status} onChange={(v) => handleStatusChange(record.cpId, v)} style={{ width: 120 }} size="small" options={STATUS_OPTIONS} />),
        onHeaderCell: () => makeDraggableHeader('status'),
      },
      { title: '推荐理由', dataIndex: 'recommendReason', key: 'recommendReason', width: 200, ellipsis: true,
        render: (v: string) => v ? <Tooltip title={v}>{v}</Tooltip> : '-',
        onHeaderCell: () => makeDraggableHeader('recommendReason'),
      },
      { title: '对接实施', dataIndex: 'implementation', key: 'implementation', width: 100, ellipsis: true,
        render: (v: string) => v || '-',
        onHeaderCell: () => makeDraggableHeader('implementation'),
      },
      { title: '备注', key: 'remark', width: 100,
        render: () => '-',
        onHeaderCell: () => makeDraggableHeader('remark'),
      },
    ];
    // 为可筛选列添加Excel风格筛选（下拉勾选 + 搜索）
    const filterableKeys = ['recommender', 'pushDate', 'projectPosition', 'department', 'candidateName', 'status', 'recommendReason', 'implementation'];
    allCols.forEach((col) => {
      if (filterableKeys.includes(col.key)) {
        col.filters = getFilterOptions(col.key);
        col.filterSearch = true;
        col.filterMultiple = true;
        col.filteredValue = listFilters[col.key] || null;
        col.onFilter = (value: any, record: any) => colValueGetters[col.key](record) === value;
        col.filterIcon = (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />;
      }
    });
    // 按保存的顺序排列列
    const ordered = allCols.sort((a, b) => {
      const ai = listColOrder.indexOf(a.key);
      const bi = listColOrder.indexOf(b.key);
      return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999);
    });
    return ordered;
  };

  const listColumns = buildListColumns();
  const [positions, setPositions] = useState<any[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // 候选人详情弹窗
  const [candidateDetailOpen, setCandidateDetailOpen] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);

  // 面试安排弹窗
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [interviewForm] = Form.useForm();
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewCpId, setInterviewCpId] = useState<number>(0);

  // 推荐人筛选弹窗
  const [recommenderModalOpen, setRecommenderModalOpen] = useState(false);
  const [recommenderName, setRecommenderName] = useState('');
  const [recommenderList, setRecommenderList] = useState<any[]>([]);

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
  const [exportStep, setExportStep] = useState(0); // 0=选择字段 1=选择候选人
  const [exportSelectedCandidates, setExportSelectedCandidates] = useState<string[]>([]); // 勾选的分组key
  const [exportFilterRecommender, setExportFilterRecommender] = useState<string | undefined>();
  const [exportFilterDate, setExportFilterDate] = useState<string | undefined>();
  const [exportFilterPosition, setExportFilterPosition] = useState<string | undefined>();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // 分组唯一key（与表格rowKey一致）
  const groupKey = (g: any) => `${g.name}_${g.contactPhone || g.phone}`;

  // 导出第二步：按推荐人/推荐时间/岗位筛选后的分组
  const getExportFilteredGroups = () => groups.filter((g: any) => {
    if (exportFilterRecommender) {
      const has = (g.positions || []).some((p: any) => p.recommender === exportFilterRecommender);
      if (!has) return false;
    }
    if (exportFilterDate) {
      const has = (g.positions || []).some((p: any) => p.pushDate?.substring?.(0, 10) === exportFilterDate);
      if (!has) return false;
    }
    if (exportFilterPosition) {
      const has = (g.positions || []).some((p: any) => p.positionTitle === exportFilterPosition);
      if (!has) return false;
    }
    return true;
  });

  // 导出简历弹窗状态
  const [resumeExportOpen, setResumeExportOpen] = useState(false);
  const [resumeExportProjectId, setResumeExportProjectId] = useState<number | undefined>();
  const [resumeExportPositionId, setResumeExportPositionId] = useState<number | undefined>();
  const [resumeExportCandidates, setResumeExportCandidates] = useState<any[]>([]);
  const [resumeExportSelected, setResumeExportSelected] = useState<number[]>([]);
  const [resumeExportLoading, setResumeExportLoading] = useState(false);

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
      if (viewMode === 'grouped') {
        const res: any = await getCandidatesGrouped({
          keyword: keyword || undefined,
          projectId: filterProjectId,
          positionId: filterPositionId,
          status: filterStatus,
        });
        setGroups(res.data || res || []);
      } else {
        const res: any = await getCandidatesList({
          keyword: keyword || undefined,
          projectId: filterProjectId,
          positionId: filterPositionId,
          status: filterStatus,
        });
        setFlatList(res.data || res || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [viewMode, keyword, filterProjectId, filterPositionId, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (cpId: number, newStatus: string) => {
    if (newStatus === 'pending_interview') {
      // 打开面试安排弹窗
      setInterviewCpId(cpId);
      interviewForm.resetFields();
      setInterviewModalOpen(true);
      return;
    }
    try {
      await updateCandidatePositionStatus(cpId, newStatus);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateInterview = async () => {
    try {
      const values = await interviewForm.validateFields();
      setInterviewLoading(true);
      await createInterview({
        candidatePositionId: interviewCpId,
        interviewType: values.interviewType || 'online',
        round: 1,
        scheduledAt: values.scheduledAt?.toISOString(),
        meetingLink: values.meetingLink,
      });
      message.success('面试安排成功');
      setInterviewModalOpen(false);
      interviewForm.resetFields();
      loadData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '面试安排失败');
    } finally {
      setInterviewLoading(false);
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

    // 仅导出勾选的候选人
    const selectedGroups = groups.filter((g: any) => exportSelectedCandidates.includes(groupKey(g)));

    const rows: Record<string, any>[] = [];
    selectedGroups.forEach((group: any) => {
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

  // 打开导出简历弹窗，从当前列表筛选有简历的候选人
  const openResumeExport = () => {
    setResumeExportOpen(true);
    setResumeExportProjectId(undefined);
    setResumeExportPositionId(undefined);
    setResumeExportSelected([]);
    // 从当前候选人列表中筛选有简历的
    const candidatesWithResume: any[] = [];
    const seenIds = new Set<number>();
    groups.forEach(g => {
      const resumeUrl = g.resumeUrl || g.positions?.find((p: any) => p.resumeUrl)?.resumeUrl;
      if (resumeUrl && g.candidateIds?.length) {
        const cid = g.candidateIds[0];
        if (!seenIds.has(cid)) {
          seenIds.add(cid);
          candidatesWithResume.push({
            id: cid,
            name: g.name,
            resumeUrl,
            positions: g.positions,
          });
        }
      }
    });
    setResumeExportCandidates(candidatesWithResume);
  };

  const handleExportResumes = async () => {
    if (resumeExportSelected.length === 0) {
      message.warning('请选择要导出的候选人');
      return;
    }
    try {
      message.loading({ content: '正在打包简历文件...', key: 'exportResumes', duration: 0 });
      const params = new URLSearchParams();
      params.append('candidateIds', resumeExportSelected.join(','));
      if (resumeExportProjectId) params.append('projectId', String(resumeExportProjectId));
      if (resumeExportPositionId) params.append('positionId', String(resumeExportPositionId));
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
      setResumeExportOpen(false);
    } catch {
      message.error({ content: '导出简历文件失败', key: 'exportResumes' });
    }
  };

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as 'grouped' | 'list')}
          options={[
            { label: '列表视图', value: 'list' },
            { label: '分组视图', value: 'grouped' },
          ]}
        />
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
        <Button type="primary" icon={<ExportOutlined />} onClick={() => { setExportStep(0); setExportSelectedCandidates(groups.map(groupKey)); setExportModalOpen(true); }} disabled={groups.length === 0}>
          导出Excel
        </Button>
        <Button icon={<ExportOutlined />} onClick={handleExportCSV} disabled={groups.length === 0}>
          导出CSV
        </Button>
        <Button icon={<ExportOutlined />} onClick={openResumeExport} disabled={groups.length === 0}>
          导出简历文件
        </Button>
      </div>

      {/* 导出简历文件弹窗 */}
      <Modal
        title="导出简历文件"
        open={resumeExportOpen}
        onCancel={() => setResumeExportOpen(false)}
        width={680}
        footer={[
          <Button key="cancel" onClick={() => setResumeExportOpen(false)}>取消</Button>,
          <Button key="export" type="primary" onClick={handleExportResumes} disabled={resumeExportSelected.length === 0}>
            导出选中 ({resumeExportSelected.length})
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Select
            placeholder="筛选项目"
            value={resumeExportProjectId}
            onChange={(v) => { setResumeExportProjectId(v); setResumeExportPositionId(undefined); }}
            allowClear
            style={{ width: 160 }}
            options={projects.map((p: any) => ({ value: p.id, label: p.name }))}
          />
          <Select
            placeholder="筛选岗位"
            value={resumeExportPositionId}
            onChange={setResumeExportPositionId}
            allowClear
            style={{ width: 180 }}
            options={positions
              .filter((p: any) => !resumeExportProjectId || p.projectId === resumeExportProjectId)
              .map((p: any) => ({ value: p.id, label: p.positionDuty }))}
          />
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
          勾选要导出简历的候选人（仅显示有简历的候选人）
        </div>
        <Spin spinning={resumeExportLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
            <Checkbox
              style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'block', background: '#fafafa' }}
              checked={resumeExportSelected.length === resumeExportCandidates.length && resumeExportCandidates.length > 0}
              indeterminate={resumeExportSelected.length > 0 && resumeExportSelected.length < resumeExportCandidates.length}
              onChange={(e) => setResumeExportSelected(e.target.checked ? resumeExportCandidates.map((c: any) => c.id) : [])}
            >
              全选 ({resumeExportCandidates.length} 人)
            </Checkbox>
            {resumeExportCandidates
              .filter((c: any) => {
                if (resumeExportProjectId && c.projectId && c.projectId !== resumeExportProjectId) return false;
                if (resumeExportPositionId && c.positionId && c.positionId !== resumeExportPositionId) return false;
                return true;
              })
              .map((c: any) => (
                <div key={c.id} style={{ padding: '6px 12px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={resumeExportSelected.includes(c.id)}
                    onChange={(e) => {
                      setResumeExportSelected(prev =>
                        e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                      );
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    {c.positionTitle && <span style={{ color: '#888', marginLeft: 8 }}>- {c.positionTitle}</span>}
                    {c.projectName && <span style={{ color: '#aaa', marginLeft: 8 }}>({c.projectName})</span>}
                  </Checkbox>
                </div>
              ))}
            {resumeExportCandidates.length === 0 && !resumeExportLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无有简历的候选人</div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 导出配置弹窗 */}
      <Modal
        title="导出候选人数据"
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        width={560}
        footer={[
          <Button key="cancel" onClick={() => setExportModalOpen(false)}>取消</Button>,
          ...(exportStep === 0
            ? [
                <Button key="reset" onClick={() => { setExportFields(DEFAULT_EXPORT_FIELDS); setCheckedKeys(DEFAULT_EXPORT_FIELDS.map((f) => f.key)); }}>恢复默认</Button>,
                <Button key="next" type="primary" onClick={() => setExportStep(1)} disabled={checkedKeys.length === 0}>
                  下一步：选择候选人
                </Button>,
              ]
            : [
                <Button key="prev" onClick={() => setExportStep(0)}>上一步</Button>,
                <Button key="export" type="primary" onClick={handleConfirmExport} disabled={exportSelectedCandidates.length === 0}>
                  确认导出 ({exportSelectedCandidates.length} 人)
                </Button>,
              ]),
        ]}
      >
        <Steps
          size="small"
          current={exportStep}
          items={[{ title: '选择字段' }, { title: '选择候选人' }]}
          style={{ marginBottom: 16 }}
        />

        {exportStep === 0 && (
        <>
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
        </>
        )}

        {exportStep === 1 && (
        <>
        <div style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
          勾选要导出的候选人（默认全选），可按推荐人、推荐时间、岗位筛选后勾选。确认后仅导出勾选的候选人数据。
        </div>
        {/* 筛选栏 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <Select
            placeholder="按推荐人筛选"
            value={exportFilterRecommender}
            onChange={setExportFilterRecommender}
            allowClear
            style={{ width: 140 }}
            options={Array.from(new Set(groups.flatMap((g: any) => (g.positions || []).map((p: any) => p.recommender).filter(Boolean)))).map((v) => ({ value: v, label: v }))}
          />
          <Select
            placeholder="按推荐时间筛选"
            value={exportFilterDate}
            onChange={setExportFilterDate}
            allowClear
            style={{ width: 140 }}
            options={Array.from(new Set(groups.flatMap((g: any) => (g.positions || []).map((p: any) => p.pushDate?.substring?.(0, 10)).filter(Boolean)))).sort().reverse().map((v) => ({ value: v, label: v }))}
          />
          <Select
            placeholder="按岗位筛选"
            value={exportFilterPosition}
            onChange={setExportFilterPosition}
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 180 }}
            options={Array.from(new Set(groups.flatMap((g: any) => (g.positions || []).map((p: any) => p.positionTitle).filter(Boolean)))).map((v) => ({ value: v, label: v }))}
          />
          <Button
            size="small"
            onClick={() => {
              // 勾选当前筛选结果
              const filteredKeys = getExportFilteredGroups().map(groupKey);
              setExportSelectedCandidates(Array.from(new Set([...exportSelectedCandidates, ...filteredKeys])));
            }}
          >
            勾选当前筛选结果
          </Button>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Checkbox
            checked={exportSelectedCandidates.length === groups.length && groups.length > 0}
            indeterminate={exportSelectedCandidates.length > 0 && exportSelectedCandidates.length < groups.length}
            onChange={(e) => setExportSelectedCandidates(e.target.checked ? groups.map(groupKey) : [])}
          >
            全选 ({groups.length} 人)
          </Checkbox>
          <span style={{ color: '#888', marginLeft: 12, fontSize: 12 }}>
            当前筛选 {getExportFilteredGroups().length} 人，已勾选 {exportSelectedCandidates.length} 人
          </span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
          {getExportFilteredGroups().map((g: any) => {
            const key = groupKey(g);
            const checked = exportSelectedCandidates.includes(key);
            const firstPos = g.positions?.[0];
            return (
              <div key={key} style={{ padding: '6px 12px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'flex-start' }}>
                <Checkbox
                  checked={checked}
                  onChange={(e) => {
                    setExportSelectedCandidates(prev =>
                      e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)
                    );
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{g.name}</span>
                  <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>{g.contactPhone || g.phone || ''}</span>
                  <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    {g.positions?.length > 0 ? g.positions.map((p: any, i: number) => (
                      <div key={i}>
                        <span style={{ color: '#333' }}>{p.positionTitle || p.projectName || '-'}</span>
                        <span style={{ color: '#999', marginLeft: 8 }}>{p.recommender ? `推荐人:${p.recommender}` : ''}</span>
                        <span style={{ color: '#999', marginLeft: 8 }}>{p.pushDate ? `${p.pushDate.substring(0, 10)}` : ''}</span>
                        {g.positions.length > 1 && <span style={{ color: '#bbb', marginLeft: 6 }}>({i + 1}/{g.positions.length})</span>}
                      </div>
                    )) : <span style={{ color: '#aaa' }}>无关联岗位</span>}
                  </div>
                </Checkbox>
              </div>
            );
          })}
          {getExportFilteredGroups().length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>无符合筛选条件的候选人</div>
          )}
        </div>
        </>
        )}
      </Modal>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#999', fontSize: 12 }}>提示：拖动表头可调整列顺序；点击表头筛选图标，下拉框支持搜索和勾选筛选（仅自己可见）</span>
            <Button size="small" onClick={() => { saveColOrder(DEFAULT_COL_ORDER); setListFilters({}); localStorage.removeItem(LIST_FILTERS_KEY); }}>
              重置列顺序和筛选
            </Button>
          </div>
          <Table
            dataSource={filteredFlatList}
            rowKey="cpId"
            loading={loading}
            pagination={{ pageSize: 50, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 1800, y: 'calc(100vh - 350px)' }}
            sticky
            size="small"
            columns={listColumns}
            onChange={(_pg: any, filters: any) => {
              const next: Record<string, string[]> = {};
              Object.entries(filters).forEach(([k, v]) => {
                if (Array.isArray(v) && v.length) next[k] = v as string[];
              });
              saveFilters(next);
            }}
          />
        </div>
      )}

      {/* 分组视图 */}
      {viewMode === 'grouped' && (
      <Table
        dataSource={groups}
        rowKey={(r) => `${r.name}_${r.contactPhone || r.phone}`}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 人` }}
        scroll={{ x: 1600, y: 'calc(100vh - 320px)' }}
        sticky
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

      )}

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

      {/* 面试安排弹窗 */}
      <Modal
        title="安排面试"
        open={interviewModalOpen}
        onOk={handleCreateInterview}
        onCancel={() => { setInterviewModalOpen(false); interviewForm.resetFields(); }}
        confirmLoading={interviewLoading}
        destroyOnClose
      >
        <Form form={interviewForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="interviewType" label="面试形式" initialValue="online" rules={[{ required: true }]}>
            <Select options={[
              { value: 'online', label: '线上' },
              { value: 'onsite', label: '现场' },
              { value: 'phone', label: '电话' },
              { value: 'video', label: '视频' },
            ]} />
          </Form.Item>
          <Form.Item name="scheduledAt" label="面试时间" rules={[{ required: true, message: '请选择面试时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择面试时间" />
          </Form.Item>
          <Form.Item name="meetingLink" label="会议链接/信息">
            <Input placeholder="请输入会议链接或面试地点" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 推荐人推荐记录弹窗 */}
      <Modal
        title={`${recommenderName} 的推荐记录`}
        open={recommenderModalOpen}
        onCancel={() => { setRecommenderModalOpen(false); setRecommenderList([]); }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Table
          dataSource={recommenderList}
          rowKey="cpId"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '推荐日期',
              key: 'date',
              width: 110,
              render: (_: any, r: any) => r.pushDate ? r.pushDate.substring(0, 10) : (r.recommendedAt ? r.recommendedAt.substring(0, 10) : '-'),
            },
            {
              title: '姓名',
              key: 'name',
              width: 100,
              render: (_: any, r: any) => r.candidateName,
            },
            {
              title: '项目',
              key: 'project',
              width: 120,
              render: (_: any, r: any) => r.projectName || '-',
            },
            {
              title: '岗位',
              key: 'position',
              width: 120,
              render: (_: any, r: any) => r.positionDuty || '-',
            },
            {
              title: '简历',
              key: 'resume',
              width: 60,
              render: (_: any, r: any) => r.resumeUrl ? (
                <a href={r.resumeUrl} target="_blank" rel="noopener noreferrer">
                  <FilePdfOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                </a>
              ) : '-',
            },
            {
              title: '分数',
              key: 'score',
              width: 70,
              render: (_: any, r: any) => r.matchScore > 0 ? <MatchScoreTag score={r.matchScore} /> : '-',
            },
            {
              title: '状态',
              key: 'status',
              width: 100,
              render: (_: any, r: any) => <StatusTag status={r.status} type="candidate" />,
            },
          ]}
        />
      </Modal>
    </div>
  );
}
