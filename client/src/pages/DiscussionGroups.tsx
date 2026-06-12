import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, List, Input, Button, Avatar, Tag, Dropdown, Modal, Select, Space, Tooltip, Badge,
  Empty, Spin, message as antMessage, Descriptions, Divider, Table,
} from 'antd';
import {
  TeamOutlined, SendOutlined, UserOutlined,
  LinkOutlined, PlusOutlined, ReloadOutlined, UserAddOutlined,
} from '@ant-design/icons';
import { useUserStore } from '../stores/user';
import { on, off } from '../socket';
import {
  getMyGroups, getMessages, sendMessage, getMembers,
} from '../api/discussion';
import { getPositions } from '../api/position';
import { getCandidates, getCandidate } from '../api/candidate';
import { getInterviews } from '../api/interview';
import StatusTag from '../components/StatusTag';

const { TextArea } = Input;

interface GroupItem {
  id: number;
  name: string;
  projectId?: number;
  projectName?: string;
  memberCount?: number;
  lastMessage?: {
    content: string;
    senderName?: string;
    createdAt?: string;
  };
}

interface MessageItem {
  id: number;
  content: string;
  senderId: number;
  senderName?: string;
  senderAvatar?: string;
  mentionIds?: number[];
  referenceType?: string;
  referenceId?: number;
  referenceData?: any;
  createdAt: string;
}

interface MemberItem {
  id: number;
  name?: string;
  nickname?: string;
  username?: string;
  avatar?: string;
}

// 引用类型配置
const referenceTypeOptions = [
  { value: 'position', label: '引用岗位' },
  { value: 'candidate', label: '引用候选人' },
  { value: 'resume', label: '引用简历' },
  { value: 'interview', label: '引用面试安排' },
];

const referenceTypeColors: Record<string, string> = {
  position: '#1890ff',
  candidate: '#52c41a',
  resume: '#fa8c16',
  interview: '#722ed1',
};

const referenceTypeLabels: Record<string, string> = {
  position: '岗位',
  candidate: '候选人',
  resume: '简历',
  interview: '面试安排',
};

export default function DiscussionGroups() {
  const user = useUserStore((s) => s.user);
  const navigate = useNavigate();

  // 讨论组列表
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // 消息
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // 成员
  const [members, setMembers] = useState<MemberItem[]>([]);

  // 输入
  const [inputText, setInputText] = useState('');
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [referenceType, setReferenceType] = useState<string | undefined>();
  const [referenceId, setReferenceId] = useState<number | undefined>();
  const [referenceData, setReferenceData] = useState<any>(undefined);
  const [sending, setSending] = useState(false);

  // 候选人详情弹窗
  const [candidateDetailOpen, setCandidateDetailOpen] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);

  // 面试详情弹窗
  const [interviewDetailOpen, setInterviewDetailOpen] = useState(false);
  const [interviewDetail, setInterviewDetail] = useState<any>(null);

  // @提及下拉
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);

  // 引用选择弹窗
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [refSelectType, setRefSelectType] = useState<string>('');
  const [refOptions, setRefOptions] = useState<any[]>([]);
  const [refOptionsLoading, setRefOptionsLoading] = useState(false);
  const [refSearchKeyword, setRefSearchKeyword] = useState('');
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);

  const messageListRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const selectedGroupIdRef = useRef<number | null>(null);

  // 同步ref
  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  // 当前选中的讨论组
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const currentProjectId = selectedGroup?.projectId;

  // 加载讨论组列表
  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res: any = await getMyGroups();
      const data = res.data || res || [];
      const list = Array.isArray(data) ? data : [];
      setGroups(list.map((g: any) => ({
        id: g.id,
        name: g.name,
        projectId: g.projectId || g.project?.id,
        projectName: g.projectName || g.project?.name,
        memberCount: g.members?.length || 0,
        lastMessage: g.lastMessage,
      })));
    } catch {
      antMessage.error('加载讨论组失败');
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // 加载消息
  const loadMessages = useCallback(async (groupId: number, before?: number) => {
    try {
      if (!before) setMessagesLoading(true);
      const res: any = await getMessages(groupId, { limit: 30, before });
      const data = res.data || res || [];
      const newMessages = Array.isArray(data) ? data : [];
      if (before) {
        setMessages((prev) => [...newMessages, ...prev]);
        setHasMoreMessages(newMessages.length >= 30);
      } else {
        setMessages(newMessages);
        setHasMoreMessages(newMessages.length >= 30);
      }
    } catch {
      antMessage.error('加载消息失败');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // 加载成员
  const loadMembers = useCallback(async (groupId: number) => {
    try {
      const res: any = await getMembers(groupId);
      const data = res.data || res || {};
      const leader = data.leader ? [data.leader] : [];
      const memberList = Array.isArray(data.members) ? data.members : [];
      // 合并组长和成员，去重
      const all = [...leader, ...memberList];
      const unique = all.filter((m: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === m.id) === i);
      setMembers(unique);
    } catch {
      setMembers([]);
    }
  }, []);

  // 选中讨论组
  useEffect(() => {
    if (selectedGroupId) {
      loadMessages(selectedGroupId);
      loadMembers(selectedGroupId);
      setInputText('');
      setMentionIds([]);
      setReferenceType(undefined);
      setReferenceId(undefined);
      setReferenceData(undefined);
    }
  }, [selectedGroupId, loadMessages, loadMembers]);

  // WebSocket 实时消息 - 使用ref避免闭包问题
  useEffect(() => {
    const handler = (data: { groupId: number; message: any }) => {
      const currentGroupId = selectedGroupIdRef.current;
      if (data.groupId === currentGroupId) {
        setMessages((prev) => {
          // 避免重复添加（发送时已乐观添加）
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      // 更新讨论组列表中的最后消息
      setGroups((prev) =>
        prev.map((g) =>
          g.id === data.groupId
            ? {
                ...g,
                lastMessage: {
                  content: data.message.content,
                  senderName: data.message.senderName || data.message.sender?.nickname || data.message.sender?.name,
                  createdAt: data.message.createdAt,
                },
              }
            : g
        )
      );
    };

    on('discussion.message', handler);
    return () => off('discussion.message', handler);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (isAutoScrollRef.current && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  // 加载更多消息（向上翻页）
  const handleScrollUp = () => {
    if (!messageListRef.current || !selectedGroupId || !hasMoreMessages) return;
    const { scrollTop } = messageListRef.current;
    if (scrollTop < 50) {
      const oldestMsgId = messages[0]?.id;
      if (oldestMsgId) {
        isAutoScrollRef.current = false;
        const prevScrollHeight = messageListRef.current.scrollHeight;
        loadMessages(selectedGroupId, oldestMsgId).then(() => {
          requestAnimationFrame(() => {
            if (messageListRef.current) {
              messageListRef.current.scrollTop = messageListRef.current.scrollHeight - prevScrollHeight;
            }
            isAutoScrollRef.current = true;
          });
        });
      }
    }
  };

  // 发送消息（乐观更新）
  const handleSend = async () => {
    if (!selectedGroupId || !inputText.trim()) return;
    const tempId = -Date.now(); // 临时ID
    const optimisticMsg: MessageItem = {
      id: tempId,
      content: inputText.trim(),
      senderId: user?.id || 0,
      senderName: user?.nickname || user?.name || user?.username || '我',
      mentionIds: mentionIds.length > 0 ? mentionIds : undefined,
      referenceType,
      referenceId,
      referenceData,
      createdAt: new Date().toISOString(),
    };

    // 乐观添加到消息列表
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setMentionIds([]);
    setReferenceType(undefined);
    setReferenceId(undefined);
    setReferenceData(undefined);

    try {
      setSending(true);
      const res: any = await sendMessage(selectedGroupId, {
        content: optimisticMsg.content,
        mentionIds: optimisticMsg.mentionIds,
        referenceType: optimisticMsg.referenceType,
        referenceId: optimisticMsg.referenceId,
        referenceData: optimisticMsg.referenceData,
      });
      // 用服务器返回的真实消息替换临时消息
      const savedMsg = res.data || res;
      if (savedMsg && savedMsg.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...savedMsg, id: savedMsg.id } : m))
        );
      }
    } catch {
      antMessage.error('发送失败');
      // 移除乐观添加的消息
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // @提及：插入成员名
  const handleMentionSelect = (member: MemberItem) => {
    const displayName = member.nickname || member.name || member.username || `用户${member.id}`;
    setInputText((prev) => prev + `@${displayName} `);
    if (!mentionIds.includes(member.id)) {
      setMentionIds((prev) => [...prev, member.id]);
    }
    setMentionDropdownOpen(false);
  };

  // 成员下拉菜单
  const memberDropdownItems = members
    .filter((m) => m.id !== user?.id)
    .map((m) => ({
      key: m.id,
      label: m.nickname || m.name || m.username || `用户${m.id}`,
      onClick: () => handleMentionSelect(m),
    }));

  // 打开引用选择弹窗
  const openRefModal = async (type: string) => {
    setRefSelectType(type);
    setRefSearchKeyword('');
    setSelectedRefId(null);
    setRefModalOpen(true);
    await loadRefOptions(type, '');
  };

  // 加载引用选项 - 只加载当前项目的数据
  const loadRefOptions = async (type: string, keyword: string) => {
    try {
      setRefOptionsLoading(true);
      let data: any[] = [];
      switch (type) {
        case 'position': {
          const params: any = { keyword };
          if (currentProjectId) params.projectId = currentProjectId;
          const res: any = await getPositions(params);
          data = (res.data || res || []);
          // 如果有项目ID，进一步过滤
          if (currentProjectId) {
            data = data.filter((p: any) => p.projectId === currentProjectId || p.project?.id === currentProjectId);
          }
          break;
        }
        case 'candidate': {
          const res: any = await getCandidates();
          const all = (res.data || res || []);
          // 过滤当前项目的候选人
          let filtered = all;
          if (currentProjectId) {
            filtered = all.filter((c: any) =>
              c.positions?.some((cp: any) => cp.projectId === currentProjectId || cp.project?.id === currentProjectId)
            );
          }
          data = keyword
            ? filtered.filter((c: any) => c.name?.includes(keyword) || c.contactPhone?.includes(keyword))
            : filtered;
          break;
        }
        case 'resume': {
          const res: any = await getCandidates();
          const all = (res.data || res || []);
          // 过滤当前项目有简历的候选人
          let filtered = all.filter((c: any) => c.resumeUrl);
          if (currentProjectId) {
            filtered = filtered.filter((c: any) =>
              c.positions?.some((cp: any) => cp.projectId === currentProjectId || cp.project?.id === currentProjectId)
            );
          }
          data = keyword
            ? filtered.filter((c: any) => c.name?.includes(keyword))
            : filtered;
          break;
        }
        case 'interview': {
          const res: any = await getInterviews();
          data = (res.data || res || []);
          // 过滤当前项目的面试
          if (currentProjectId) {
            data = data.filter((i: any) =>
              i.candidatePosition?.position?.projectId === currentProjectId ||
              i.candidatePosition?.position?.project?.id === currentProjectId
            );
          }
          if (keyword) {
            data = data.filter((i: any) =>
              i.candidatePosition?.candidate?.name?.includes(keyword) ||
              i.interviewType?.includes(keyword)
            );
          }
          break;
        }
      }
      setRefOptions(Array.isArray(data) ? data : []);
    } catch {
      setRefOptions([]);
    } finally {
      setRefOptionsLoading(false);
    }
  };

  // 确认引用选择
  const handleRefConfirm = () => {
    if (!selectedRefId || !refSelectType) return;
    const item = refOptions.find((o: any) => o.id === selectedRefId);
    if (!item) return;

    setReferenceType(refSelectType);
    setReferenceId(selectedRefId);
    // 存储精简的引用数据，包含足够的信息展示和跳转
    const refData = buildRefData(refSelectType, item);
    setReferenceData(refData);
    setRefModalOpen(false);

    // 在输入框中插入引用标记
    const label = getRefItemLabel(refSelectType, item);
    setInputText((prev) => prev + `[${referenceTypeLabels[refSelectType]}: ${label}] `);
  };

  // 构建引用数据（精简但包含跳转所需信息）
  const buildRefData = (type: string, item: any) => {
    switch (type) {
      case 'position':
        return {
          id: item.id,
          systemName: item.systemName,
          positionDuty: item.positionDuty,
          projectName: item.projectName || item.project?.name,
          projectId: item.projectId || item.project?.id,
          status: item.status,
          requiredCount: item.requiredCount,
          workLocation: item.workLocation,
        };
      case 'candidate':
        return {
          id: item.id,
          name: item.name,
          contactPhone: item.contactPhone,
          email: item.email,
          status: item.positions?.[0]?.status,
          positionName: item.positions?.[0]?.positionTitle || item.positions?.[0]?.positionDuty,
          projectId: item.positions?.[0]?.projectId || item.positions?.[0]?.project?.id,
          positionId: item.positions?.[0]?.positionId || item.positions?.[0]?.position?.id,
          cpId: item.positions?.[0]?.cpId || item.positions?.[0]?.id,
        };
      case 'resume':
        return {
          id: item.id,
          name: item.name,
          resumeUrl: item.resumeUrl,
          contactPhone: item.contactPhone,
          positionName: item.positions?.[0]?.positionTitle || item.positions?.[0]?.positionDuty,
          projectId: item.positions?.[0]?.projectId || item.positions?.[0]?.project?.id,
          positionId: item.positions?.[0]?.positionId || item.positions?.[0]?.position?.id,
        };
      case 'interview':
        return {
          id: item.id,
          interviewType: item.interviewType,
          scheduledAt: item.scheduledAt,
          meetingLink: item.meetingLink,
          result: item.result,
          candidateName: item.candidatePosition?.candidate?.name,
          candidateId: item.candidatePosition?.candidate?.id,
          positionName: item.candidatePosition?.position?.positionDuty || item.candidatePosition?.positionTitle,
          projectId: item.candidatePosition?.position?.projectId || item.candidatePosition?.position?.project?.id,
          positionId: item.candidatePosition?.position?.id,
        };
      default:
        return { id: item.id };
    }
  };

  // 获取引用项显示名称
  const getRefItemLabel = (type: string, item: any): string => {
    switch (type) {
      case 'position': return item.systemName || item.positionDuty || `岗位#${item.id}`;
      case 'candidate': return item.name || `候选人#${item.id}`;
      case 'resume': return `${item.name || '未知'} - ${item.resumeUrl?.split('/').pop() || '无文件'}`;
      case 'interview': {
        const cName = item.candidatePosition?.candidate?.name || '未知候选人';
        return `${cName} - ${item.interviewType || '面试'}`;
      }
      default: return `#${item.id}`;
    }
  };

  // 引用卡片点击跳转
  const handleRefClick = async (msg: MessageItem) => {
    const data = msg.referenceData;
    if (!data) return;

    switch (msg.referenceType) {
      case 'position':
        // 跳转到岗位详情页
        if (data.id) navigate(`/positions/${data.id}`);
        break;
      case 'candidate':
        // 打开候选人详情弹窗
        if (data.id) {
          try {
            setCandidateDetailLoading(true);
            setCandidateDetailOpen(true);
            const res: any = await getCandidate(data.id);
            setCandidateDetail(res.data || res);
          } catch {
            antMessage.error('获取候选人详情失败');
            setCandidateDetailOpen(false);
          } finally {
            setCandidateDetailLoading(false);
          }
        }
        break;
      case 'resume':
        // 跳转到简历所在岗位的简历库标签页
        if (data.positionId) {
          navigate(`/positions/${data.positionId}?tab=resume&highlight=${data.id}`);
        } else if (data.id) {
          // 没有岗位信息，尝试打开候选人详情弹窗
          try {
            setCandidateDetailLoading(true);
            setCandidateDetailOpen(true);
            const res: any = await getCandidate(data.id);
            setCandidateDetail(res.data || res);
          } catch {
            antMessage.error('获取候选人详情失败');
            setCandidateDetailOpen(false);
          } finally {
            setCandidateDetailLoading(false);
          }
        }
        break;
      case 'interview':
        // 打开面试详情弹窗
        if (data.id) {
          setInterviewDetail(data);
          setInterviewDetailOpen(true);
        }
        break;
    }
  };

  // 渲染引用卡片（可点击跳转）
  const renderReferenceCard = (msg: MessageItem) => {
    if (!msg.referenceType || !msg.referenceData) return null;
    const color = referenceTypeColors[msg.referenceType] || '#1890ff';
    const label = referenceTypeLabels[msg.referenceType] || msg.referenceType;
    const data = msg.referenceData;

    let content: React.ReactNode = null;
    switch (msg.referenceType) {
      case 'position':
        content = (
          <div>
            <div style={{ fontWeight: 600 }}>{data.systemName || data.positionDuty || '岗位'}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {data.projectName && <span>项目: {data.projectName}</span>}
              {data.status && <span> | 状态: {data.status}</span>}
              {data.workLocation && <span> | 地点: {data.workLocation}</span>}
            </div>
          </div>
        );
        break;
      case 'candidate':
        content = (
          <div>
            <div style={{ fontWeight: 600 }}>{data.name || '候选人'}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {data.contactPhone && <span>电话: {data.contactPhone}</span>}
              {data.positionName && <span> | 岗位: {data.positionName}</span>}
              {data.status && <span> | 状态: {data.status}</span>}
            </div>
          </div>
        );
        break;
      case 'resume':
        content = (
          <div>
            <div style={{ fontWeight: 600 }}>{data.name || '候选人'}的简历</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {data.resumeUrl && <span>文件: {data.resumeUrl.split('/').pop()}</span>}
              {data.positionName && <span> | 岗位: {data.positionName}</span>}
            </div>
          </div>
        );
        break;
      case 'interview':
        content = (
          <div>
            <div style={{ fontWeight: 600 }}>
              {data.candidateName || '候选人'} - {data.interviewType || '面试'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {data.scheduledAt && <span>时间: {new Date(data.scheduledAt).toLocaleString('zh-CN')}</span>}
              {data.positionName && <span> | 岗位: {data.positionName}</span>}
              {data.result && <span> | 结果: {data.result}</span>}
            </div>
          </div>
        );
        break;
    }

    return (
      <div
        onClick={() => handleRefClick(msg)}
        style={{
          marginTop: 6,
          padding: '8px 12px',
          borderRadius: 6,
          borderLeft: `3px solid ${color}`,
          background: `${color}10`,
          fontSize: 13,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
      >
        <Tag color={color} style={{ marginBottom: 4 }}>{label}</Tag>
        {content}
        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>点击查看详情</div>
      </div>
    );
  };

  // 渲染消息内容（高亮@提及）
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span key={idx} style={{ color: '#1890ff', fontWeight: 500 }}>
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: 0 }}>
      {/* 左侧：讨论组列表 */}
      <Card
        title="讨论组"
        extra={
          <Tooltip title="刷新">
            <Button type="text" icon={<ReloadOutlined />} onClick={loadGroups} loading={groupsLoading} />
          </Tooltip>
        }
        style={{ width: 320, minWidth: 280, borderRadius: '8px 0 0 8px' }}
        styles={{ body: { padding: 0, overflow: 'auto', height: 'calc(100% - 57px)' } }}
      >
        <List
          loading={groupsLoading}
          dataSource={groups}
          locale={{ emptyText: <Empty description="暂无讨论组" /> }}
          renderItem={(group) => (
            <List.Item
              onClick={() => setSelectedGroupId(group.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedGroupId === group.id ? '#e6f4ff' : 'transparent',
                borderLeft: selectedGroupId === group.id ? '3px solid #1890ff' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    style={{ backgroundColor: selectedGroupId === group.id ? '#1890ff' : '#87d068' }}
                    icon={<TeamOutlined />}
                  />
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{group.name}</span>
                    {group.memberCount ? (
                      <Tag style={{ fontSize: 11 }}>{group.memberCount}人</Tag>
                    ) : null}
                  </div>
                }
                description={
                  <div>
                    {group.projectName && (
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{group.projectName}</div>
                    )}
                    {group.lastMessage && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#595959',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                          marginTop: 2,
                        }}
                      >
                        {group.lastMessage.senderName && (
                          <span style={{ color: '#8c8c8c' }}>{group.lastMessage.senderName}: </span>
                        )}
                        {group.lastMessage.content}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 右侧：聊天区域 */}
      <Card
        style={{
          flex: 1,
          borderRadius: '0 8px 8px 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        {selectedGroup ? (
          <>
            {/* 聊天头部 */}
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{selectedGroup.name}</span>
                {selectedGroup.projectName && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>{selectedGroup.projectName}</Tag>
                )}
              </div>
              <Space>
                <Tooltip title="成员">
                  <Badge count={members.length} size="small" offset={[6, -4]}>
                    <TeamOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
                  </Badge>
                </Tooltip>
              </Space>
            </div>

            {/* 消息列表 */}
            <div
              ref={messageListRef}
              onScroll={handleScrollUp}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                background: '#fafafa',
              }}
            >
              {hasMoreMessages && messages.length > 0 && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      if (messages[0]?.id) {
                        isAutoScrollRef.current = false;
                        const prevScrollHeight = messageListRef.current?.scrollHeight || 0;
                        loadMessages(selectedGroupId!, messages[0].id).then(() => {
                          requestAnimationFrame(() => {
                            if (messageListRef.current) {
                              messageListRef.current.scrollTop = messageListRef.current.scrollHeight - prevScrollHeight;
                            }
                            isAutoScrollRef.current = true;
                          });
                        });
                      }
                    }}
                  >
                    加载更多消息
                  </Button>
                </div>
              )}
              <Spin spinning={messagesLoading}>
                {messages.length === 0 && !messagesLoading ? (
                  <Empty description="暂无消息，开始聊天吧" style={{ marginTop: 80 }} />
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isSelf ? 'flex-end' : 'flex-start',
                          marginBottom: 16,
                        }}
                      >
                        {!isSelf && (
                          <Avatar
                            size={36}
                            style={{
                              backgroundColor: '#1677ff',
                              marginRight: 10,
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                            icon={<UserOutlined />}
                            src={msg.senderAvatar || undefined}
                          />
                        )}
                        <div style={{ maxWidth: '65%' }}>
                          {!isSelf && (
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                              {msg.senderName || `用户${msg.senderId}`}
                            </div>
                          )}
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              background: isSelf ? '#1677ff' : '#fff',
                              color: isSelf ? '#fff' : '#333',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                            }}
                          >
                            {renderMessageContent(msg.content)}
                            {renderReferenceCard(msg)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#bfbfbf',
                              marginTop: 4,
                              textAlign: isSelf ? 'right' : 'left',
                            }}
                          >
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                        {isSelf && (
                          <Avatar
                            size={36}
                            style={{
                              backgroundColor: '#52c41a',
                              marginLeft: 10,
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                            icon={<UserOutlined />}
                            src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:3000${user.avatar}`) : undefined}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </Spin>
            </div>

            {/* 输入区域 */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #f0f0f0',
                background: '#fff',
              }}
            >
              {/* 已选引用标签 */}
              {referenceType && referenceData && (
                <div style={{ marginBottom: 8 }}>
                  <Tag
                    color={referenceTypeColors[referenceType]}
                    closable
                    onClose={() => {
                      setReferenceType(undefined);
                      setReferenceId(undefined);
                      setReferenceData(undefined);
                    }}
                  >
                    {referenceTypeLabels[referenceType]}: {getRefItemLabel(referenceType, referenceData)}
                  </Tag>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextArea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入消息... (Enter发送, Shift+Enter换行)"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ flex: 1 }}
                />
                <Dropdown
                  menu={{ items: memberDropdownItems }}
                  trigger={['click']}
                  open={mentionDropdownOpen}
                  onOpenChange={setMentionDropdownOpen}
                >
                  <Tooltip title="@提及成员">
                    <Button icon={<UserAddOutlined />} />
                  </Tooltip>
                </Dropdown>
                <Dropdown
                  menu={{
                    items: referenceTypeOptions.map((opt) => ({
                      key: opt.value,
                      label: opt.label,
                      onClick: () => openRefModal(opt.value),
                    })),
                  }}
                  trigger={['click']}
                >
                  <Tooltip title="引用">
                    <Button icon={<LinkOutlined />} />
                  </Tooltip>
                </Dropdown>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!inputText.trim()}
                >
                  发送
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#bfbfbf',
            }}
          >
            <TeamOutlined style={{ fontSize: 64, marginBottom: 16 }} />
            <div style={{ fontSize: 16 }}>请选择一个讨论组开始聊天</div>
          </div>
        )}
      </Card>

      {/* 引用选择弹窗 */}
      <Modal
        title={`选择${referenceTypeLabels[refSelectType] || '引用项'}`}
        open={refModalOpen}
        onOk={handleRefConfirm}
        onCancel={() => setRefModalOpen(false)}
        okButtonProps={{ disabled: !selectedRefId }}
        width={520}
        destroyOnClose
      >
        <div style={{ marginBottom: 12 }}>
          {currentProjectId && (
            <Tag color="blue" style={{ marginBottom: 8 }}>
              仅显示当前项目相关内容
            </Tag>
          )}
          <Input.Search
            placeholder="搜索..."
            value={refSearchKeyword}
            onChange={(e) => setRefSearchKeyword(e.target.value)}
            onSearch={(val) => loadRefOptions(refSelectType, val)}
            enterButton
          />
        </div>
        <Spin spinning={refOptionsLoading}>
          <List
            dataSource={refOptions.slice(0, 50)}
            style={{ maxHeight: 400, overflow: 'auto' }}
            locale={{ emptyText: '暂无数据' }}
            renderItem={(item: any) => (
              <List.Item
                onClick={() => setSelectedRefId(item.id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedRefId === item.id ? '#e6f4ff' : 'transparent',
                  borderRadius: 6,
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      style={{ backgroundColor: referenceTypeColors[refSelectType] || '#1890ff' }}
                    >
                      {(referenceTypeLabels[refSelectType] || '#')[0]}
                    </Avatar>
                  }
                  title={getRefItemLabel(refSelectType, item)}
                  description={
                    refSelectType === 'position'
                      ? `${item.projectName || item.project?.name || ''} ${item.status || ''} ${item.workLocation || ''}`
                      : refSelectType === 'candidate'
                      ? `${item.contactPhone || ''} ${item.positions?.[0]?.status || ''}`
                      : refSelectType === 'interview'
                      ? `${item.interviewType || ''} ${item.scheduledAt ? new Date(item.scheduledAt).toLocaleString('zh-CN') : ''}`
                      : item.resumeUrl
                      ? item.resumeUrl.split('/').pop()
                      : ''
                  }
                />
              </List.Item>
            )}
          />
        </Spin>
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

            {candidateDetail.candidatePositions?.length > 0 && (
              <>
                <Divider orientation="left" style={{ marginTop: 24 }}>
                  关联岗位 ({candidateDetail.candidatePositions.length})
                </Divider>
                <Table
                  dataSource={candidateDetail.candidatePositions}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '项目', key: 'project', render: (_: any, r: any) => r.position?.project?.name || '-' },
                    { title: '岗位职务', key: 'positionDuty', render: (_: any, r: any) => r.position?.positionDuty || '-' },
                    { title: '推荐人', dataIndex: 'recommender', render: (v: string) => v || '-' },
                    { title: '推送日期', dataIndex: 'pushDate', render: (v: string) => v ? v.substring(0, 10) : '-' },
                    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} type="candidate" /> },
                  ]}
                />
              </>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 面试详情弹窗 */}
      <Modal
        title="面试详情"
        open={interviewDetailOpen}
        onCancel={() => { setInterviewDetailOpen(false); setInterviewDetail(null); }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {interviewDetail ? (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="候选人">{interviewDetail.candidateName || '-'}</Descriptions.Item>
            <Descriptions.Item label="面试形式">{interviewDetail.interviewType || '-'}</Descriptions.Item>
            <Descriptions.Item label="面试时间" span={2}>
              {interviewDetail.scheduledAt ? new Date(interviewDetail.scheduledAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="会议链接/信息" span={2}>
              {interviewDetail.meetingLink ? (
                <a href={interviewDetail.meetingLink} target="_blank" rel="noopener noreferrer">{interviewDetail.meetingLink}</a>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="岗位">{interviewDetail.positionName || '-'}</Descriptions.Item>
            <Descriptions.Item label="结果">
              {interviewDetail.result ? <StatusTag status={interviewDetail.result} type="interview" /> : '待面试'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
