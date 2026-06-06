import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Space, Spin, message, Modal } from 'antd';
import { ArrowLeftOutlined, RobotOutlined, PlusOutlined } from '@ant-design/icons';
import { getPosition, getPositionCandidates, addCandidateToPosition } from '../api/position';
import { matchAnalysis } from '../api/ai';
import StatusTag from '../components/StatusTag';
import MatchScoreTag from '../components/MatchScoreTag';
import CandidateModal from '../components/CandidateModal';

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [position, setPosition] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [addExistingModalOpen, setAddExistingModalOpen] = useState(false);
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);

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

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!position) return <div>岗位不存在</div>;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回
      </Button>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Card style={{ borderRadius: 8, flex: '1 1 400px', minWidth: 300 }}>
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
          </Descriptions>
        </Card>

        <Card
          title="候选人列表"
          style={{ borderRadius: 8, flex: '2 1 500px', minWidth: 400 }}
          extra={
            <Space>
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
            rowKey={(r: any) => r.id || r.candidateId}
            pagination={false}
            locale={{ emptyText: '暂无候选人' }}
            columns={[
              {
                title: '姓名',
                key: 'candidateName',
                render: (_: any, record: any) => (
                  <a onClick={() => navigate(`/candidates/${record.candidateId || record.id}`)}>
                    {record.candidate?.name || record.candidateName || '-'}
                  </a>
                ),
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
                    <a onClick={() => navigate(`/candidates/${record.candidateId || record.id}`)}>查看</a>
                    <a onClick={() => handleAIMatch(record.candidateId || record.id)}>AI匹配</a>
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
                  <span style={{ color: '#999', marginLeft: 12 }}>{c.phone || ''}</span>
                  {c.currentCompany && <span style={{ color: '#999', marginLeft: 12 }}>{c.currentCompany}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
