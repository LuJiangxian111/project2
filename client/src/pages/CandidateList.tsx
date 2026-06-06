import { useEffect, useState, useCallback } from 'react';
import {
  Table, Input, Button, Space, Tag, Select, Badge,
} from 'antd';
import {
  SearchOutlined, UserOutlined, DownOutlined, RightOutlined,
} from '@ant-design/icons';
import {
  getCandidatesGrouped, updateCandidatePositionStatus,
} from '../api/candidate';
import { getPositions } from '../api/position';
import { getProjects } from '../api/project';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_screen: { label: '待筛选', color: 'default' },
  screen_rejected: { label: '筛选不通过', color: 'red' },
  screen_passed: { label: '筛选通过待约面', color: 'blue' },
  pending_interview: { label: '待面试', color: 'orange' },
  interview_passed: { label: '面试通过', color: 'green' },
  interview_rejected: { label: '面试不通过', color: 'volcano' },
  abandoned: { label: '放弃面试', color: 'default' },
};

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, { label }]) => ({
  value,
  label,
}));

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
      </div>

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
                <div
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => toggleExpand(key)}
                >
                  {isExpanded ? <DownOutlined style={{ fontSize: 12 }} /> : <RightOutlined style={{ fontSize: 12 }} />}
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 500 }}>{record.name}</span>
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
    </div>
  );
}
