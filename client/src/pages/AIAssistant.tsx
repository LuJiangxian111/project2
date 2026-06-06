import { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Card, Space, Avatar, Spin, message, Modal, Typography, Tag, Table, Popconfirm, Select, Tooltip } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  FileTextOutlined,
  BarChartOutlined,
  AlertOutlined,
  QuestionCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
  PaperClipOutlined,
  CloseCircleOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { chatWithAI, chatWithFile, analyzeFile } from '../api/ai';
import { createPosition, addCandidateToPosition, getPositions } from '../api/position';
import { createCandidate } from '../api/candidate';
import { getProjects } from '../api/project';

const { Paragraph } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  fileName?: string;
  importData?: {
    type: 'position' | 'candidate';
    items: any[];
    unmappedFields?: Record<string, string>;
    summary?: string;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

const quickCommands = [
  { key: 'resume', label: '简历解析', icon: <FileTextOutlined />, prompt: '请帮我解析一份简历，提取关键信息' },
  { key: 'match', label: '岗位匹配分析', icon: <BarChartOutlined />, prompt: '请帮我分析候选人与岗位的匹配情况' },
  { key: 'report', label: '招聘周报生成', icon: <LineChartOutlined />, prompt: '请帮我生成本周招聘周报' },
  { key: 'risk', label: '风险分析', icon: <AlertOutlined />, prompt: '请帮我分析当前招聘中的风险点' },
  { key: 'question', label: '面试问题生成', icon: <QuestionCircleOutlined />, prompt: '请帮我生成面试问题' },
];

const ACCEPTED_FILE_TYPES = '.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.go,.rs,.sql,.yaml,.yml,.ini,.conf,.log,.doc,.docx,.pdf,.xlsx,.xls';

const CHAT_STORAGE_KEY = 'ai_chat_sessions';
const ACTIVE_SESSION_KEY = 'ai_chat_active_session';

function loadSessions(): { sessions: ChatSession[]; activeId: string } {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 兼容旧数据：确保每个session的messages是数组
        const sessions = parsed.map((s: any) => ({
          ...s,
          messages: Array.isArray(s.messages)
            ? s.messages.map((m: any) => ({
                ...m,
                role: m.role || 'assistant',
                importData: m.importData || undefined,
              }))
            : [],
        }));
        return { sessions, activeId: savedActiveId || sessions[0].id };
      }
    }
  } catch {
    // 数据损坏时清除
    try { localStorage.removeItem(CHAT_STORAGE_KEY); localStorage.removeItem(ACTIVE_SESSION_KEY); } catch { /* ignore */ }
  }
  const defaultSession = { id: '1', title: '新对话', messages: [], createdAt: new Date().toISOString() };
  return { sessions: [defaultSession], activeId: '1' };
}

function saveSessions(sessions: ChatSession[], activeId: string) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVE_SESSION_KEY, activeId);
  } catch { /* ignore */ }
}

// 岗位字段中文映射
const POSITION_FIELD_LABELS: Record<string, string> = {
  systemName: '系统', department: '部门', requirementNumber: '需求编号',
  positionType: '岗位类型', positionDuty: '岗位职务', techDomain: '技术领域',
  majorType: '专业类型', levelDistribution: '职级分布', salaryRange: '薪资范围',
  requirements: '岗位要求', responsibilities: '岗位职责', domainExperience: '领域经验',
  region: '地区', deliveryForm: '交付形式', positionImplementation: '岗位实施',
  urgency: '紧急程度', requiredCount: '需求人数', expectedDate: '期望到岗日期',
  projectId: '所属项目',
};

// 候选人字段中文映射
const CANDIDATE_FIELD_LABELS: Record<string, string> = {
  name: '姓名', gender: '性别', idType: '证件类型', idNumber: '证件号码',
  contactPhone: '联系电话', contactEmail: '联系邮箱', areaCode: '区号',
  supplier: '供应商', educationType: '学历类型', education: '学历',
  graduationDate: '毕业时间', domainYears: '领域年限', workStatus: '工作状态',
  expectedSalary: '期望薪资', positionId: '推荐岗位',
};

export default function AIAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions().sessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadSessions().activeId);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [projectList, setProjectList] = useState<any[]>([]);
  const [positionList, setPositionList] = useState<any[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importModalData, setImportModalData] = useState<{ msgId: string; importData: ChatMessage['importData'] } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // 持久化聊天记录
  useEffect(() => {
    saveSessions(sessions, activeSessionId);
  }, [sessions, activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // 加载项目和岗位列表
  useEffect(() => {
    getProjects().then((res: any) => setProjectList(res.data || res || []));
    getPositions().then((res: any) => setPositionList(res.data || res || []));
  }, []);

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string, fileName?: string, importData?: any) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      fileName,
      importData,
    };
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const updatedMessages = [...s.messages, msg];
        const title = s.messages.length === 0 && role === 'user' ? content.substring(0, 20) : s.title;
        return { ...s, messages: updatedMessages, title };
      }),
    );
    return msg;
  };

  const updateMessage = (msgId: string, updates: Partial<ChatMessage>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => (m.id === msgId ? { ...m, ...updates } : m)),
        };
      }),
    );
  };

  // 智能导入：分析文件
  const handleAnalyzeFile = async () => {
    if (!attachedFile) return;
    const file = attachedFile;
    const instruction = inputValue.trim();
    setAttachedFile(null);
    setInputValue('');
    setSending(true);

    addMessage('user', instruction || `请帮我导入文件：${file.name}`, file.name);

    try {
      const res: any = await analyzeFile(file, instruction);
      const data = res.data || res;

      if (data.type === 'position' || data.type === 'candidate') {
        const typeLabel = data.type === 'position' ? '岗位需求' : '候选人推荐';
        const count = data.items?.length || 0;
        addMessage(
          'assistant',
          `已识别文件为**${typeLabel}**数据，共${count}条记录。\n\n${data.summary || ''}\n\n请在下方预览表格中确认数据，选择对应的项目/岗位后点击"确认导入"。`,
          undefined,
          data,
        );
      } else {
        addMessage('assistant', data.rawContent || '无法识别文件内容，请确认文件格式后重试。');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || '未知错误';
      addMessage('assistant', `文件分析失败：${errMsg}。请确认文件格式和AI配置后重试。`);
    } finally {
      setSending(false);
    }
  };

  // 点击确认导入 - 弹出项目选择弹窗
  const handleConfirmImportClick = (msgId: string, importData: ChatMessage['importData']) => {
    if (!importData || !importData.items.length) return;
    setImportModalData({ msgId, importData });
    setSelectedProjectId(null);
    setImportModalVisible(true);
  };

  // 确认导入数据
  const handleConfirmImport = async () => {
    if (!importModalData) return;
    const { msgId, importData } = importModalData;
    if (!importData || !importData.items.length) return;

    // 岗位必须选项目
    if (importData.type === 'position' && !selectedProjectId) {
      message.warning('请选择所属项目');
      return;
    }

    setImportModalVisible(false);
    setImporting(true);

    try {
      if (importData.type === 'position') {
        // 导入岗位 - 统一使用选中的项目
        let success = 0;
        let failed = 0;
        for (const item of importData.items) {
          try {
            const payload = { ...item, projectId: selectedProjectId };
            console.log('导入岗位数据:', JSON.stringify(payload));
            await createPosition(payload);
            success++;
          } catch (err: any) {
            console.error('导入岗位失败:', JSON.stringify(item), err?.response?.data || err?.message);
            failed++;
          }
        }
        updateMessage(msgId, {
          content: `岗位导入完成！成功 ${success} 条${failed > 0 ? `，失败 ${failed} 条` : ''}`,
          importData: undefined,
        });
        addMessage('system', `已成功导入 ${success} 个岗位到需求广场。`);
      } else if (importData.type === 'candidate') {
        // 导入候选人
        let success = 0;
        let failed = 0;
        for (const item of importData.items) {
          try {
            const { positionId, ...candidateData } = item;
            const candidateRes: any = await createCandidate(candidateData);
            const candidateId = candidateRes.data?.id || candidateRes.id;

            if (positionId && candidateId) {
              await addCandidateToPosition(positionId, { candidateId });
            }
            success++;
          } catch {
            failed++;
          }
        }
        updateMessage(msgId, {
          content: `候选人导入完成！成功 ${success} 条${failed > 0 ? `，失败 ${failed} 条` : ''}`,
          importData: undefined,
        });
        addMessage('system', `已成功导入 ${success} 位候选人。`);
      }
    } catch (err: any) {
      message.error('导入失败：' + (err.message || '未知错误'));
    } finally {
      setImporting(false);
      setImportModalData(null);
    }
  };

  const handleSend = async (text?: string) => {
    const content = text || inputValue.trim();

    // 有附件文件时，走智能导入流程
    if (attachedFile) {
      handleAnalyzeFile();
      return;
    }

    if (!content) return;
    setInputValue('');
    addMessage('user', content);
    setSending(true);

    try {
      const res: any = await chatWithAI(content);
      const aiContent = res.data?.content || res.data?.message || res.data || res.content || res.message || 'AI回复解析失败';
      addMessage('assistant', typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent));
    } catch (err: any) {
      addMessage('assistant', '抱歉，AI服务暂时不可用，请稍后重试。');
    } finally {
      setSending(false);
    }
  };

  const handleQuickCommand = (cmd: typeof quickCommands[0]) => {
    Modal.confirm({
      title: `确认执行：${cmd.label}`,
      content: `将发送指令"${cmd.prompt}"到AI助手，是否继续？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => handleSend(cmd.prompt),
    });
  };

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setAttachedFile(null);
  };

  const handleDeleteSession = (sessionId: string, e?: any) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const newSession = { id: Date.now().toString(), title: '新对话', messages: [], createdAt: new Date().toISOString() };
        setActiveSessionId(newSession.id);
        return [newSession];
      }
      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB');
      return;
    }
    setAttachedFile(file);
    e.target.value = '';
  };

  // 更新导入数据中某个item的字段
  const updateImportItem = (msgId: string, itemIndex: number, field: string, value: any) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== msgId || !m.importData) return m;
            const newItems = [...m.importData.items];
            newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
            return { ...m, importData: { ...m.importData, items: newItems } };
          }),
        };
      }),
    );
  };

  // 删除导入数据中某个item
  const removeImportItem = (msgId: string, itemIndex: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== msgId || !m.importData) return m;
            const newItems = m.importData.items.filter((_, i) => i !== itemIndex);
            return { ...m, importData: { ...m.importData, items: newItems } };
          }),
        };
      }),
    );
  };

  // 渲染导入预览
  const renderImportPreview = (msg: ChatMessage) => {
    if (!msg.importData) return null;
    const { type, items, unmappedFields } = msg.importData;
    if (!items || items.length === 0) return null;
    const fieldLabels = type === 'position' ? POSITION_FIELD_LABELS : CANDIDATE_FIELD_LABELS;
    const columns = Object.keys(items[0] || {})
      .filter((key) => fieldLabels[key] && key !== 'projectId' && key !== 'positionId')
      .map((key) => ({
        title: fieldLabels[key] || key,
        dataIndex: key,
        width: 120,
        render: (val: any, record: any) => (
          <Input
            value={val ?? ''}
            onChange={(e) => updateImportItem(msg.id, record._key, key, e.target.value)}
            size="small"
            variant="borderless"
            style={{ padding: 0 }}
          />
        ),
      }));

    // 添加操作列
    columns.push({
      title: '操作',
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeImportItem(msg.id, record._key)}
        />
      ),
    });

    const typeLabel = type === 'position' ? '岗位需求' : '候选人推荐';

    return (
      <div style={{ marginTop: 12, maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag color={type === 'position' ? 'blue' : 'green'}>{typeLabel} - {items.length}条</Tag>
          {unmappedFields && Object.keys(unmappedFields).length > 0 && (
            <Tooltip title={`未映射字段：${Object.entries(unmappedFields).map(([k, v]) => `${k}: ${v}`).join('、')}`}>
              <Tag color="orange">有{Object.keys(unmappedFields).length}个未映射字段</Tag>
            </Tooltip>
          )}
        </div>
        <div style={{ maxWidth: '100%', overflow: 'auto' }}>
          <Table
            dataSource={items.map((item, idx) => ({ ...item, _key: idx }))}
            rowKey="_key"
            columns={columns}
            size="small"
            pagination={items.length > 5 ? { pageSize: 5 } : false}
            scroll={{ x: columns.length * 120 }}
            bordered
            style={{ minWidth: 0 }}
          />
        </div>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={() => handleConfirmImportClick(msg.id, msg.importData!)}
            loading={importing}
            disabled={items.length === 0}
          >
            确认导入 {items.length} 条{typeLabel}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 148px)', gap: 0, overflow: 'hidden' }}>
      {/* 左侧对话历史 */}
      {!sidebarCollapsed && (
        <Card
          style={{ width: 220, minWidth: 220, borderRadius: '8px 0 0 8px', overflow: 'auto', transition: 'all 0.2s' }}
          styles={{ body: { padding: 0 } }}
        >
          <div style={{ padding: '12px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleNewSession}>
              新对话
            </Button>
            <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={() => setSidebarCollapsed(true)} />
          </div>
          <List
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                onClick={() => { setActiveSessionId(session.id); setAttachedFile(null); }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: session.id === activeSessionId ? '#e6f7ff' : 'transparent',
                  borderLeft: session.id === activeSessionId ? '3px solid #1890ff' : '3px solid transparent',
                }}
                extra={
                  <Popconfirm title="删除此对话？" onConfirm={(e) => handleDeleteSession(session.id, e)} onCancel={(e) => e?.stopPropagation()}>
                    <Button type="text" size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} danger />
                  </Popconfirm>
                }
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  {session.title}
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
      {sidebarCollapsed && (
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={() => setSidebarCollapsed(false)}
          style={{ position: 'absolute', zIndex: 10, margin: 8 }}
        />
      )}

      {/* 右侧对话区 */}
      <Card
        style={{ flex: 1, minWidth: 0, borderRadius: '0 8px 8px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', minWidth: 0 } }}
      >
        {/* 消息区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeSession?.messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#bfbfbf' }}>
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>AI智能助手</div>
              <div style={{ fontSize: 13 }}>我可以帮您进行简历解析、岗位匹配、风险分析等操作</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                <ImportOutlined style={{ marginRight: 4 }} />
                上传岗位需求表或候选人推荐表，我可以智能识别并导入到系统中
              </div>
            </div>
          )}
          {activeSession?.messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start',
                marginBottom: 16,
                alignItems: 'flex-start',
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  icon={<RobotOutlined />}
                  style={{ backgroundColor: '#1890ff', marginRight: 8, flexShrink: 0, marginTop: 2 }}
                />
              )}
              <div
                style={{
                  maxWidth: msg.role === 'system' ? '80%' : msg.role === 'user' ? '65%' : '75%',
                  padding: msg.role === 'system' ? '6px 16px' : '10px 16px',
                  borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : msg.role === 'system' ? 16 : '12px 12px 12px 0',
                  background: msg.role === 'user' ? '#1890ff' : msg.role === 'system' ? '#f6ffed' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : msg.role === 'system' ? '#52c41a' : '#333',
                  border: msg.role === 'system' ? '1px solid #b7eb8f' : 'none',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowX: 'auto',
                  overflowWrap: 'break-word',
                  boxSizing: 'border-box',
                }}
              >
                {msg.role === 'system' && <CheckCircleOutlined style={{ marginRight: 6 }} />}
                {msg.fileName && (
                  <div style={{ marginBottom: 6, opacity: 0.8, fontSize: 12 }}>
                    <PaperClipOutlined style={{ marginRight: 4 }} />
                    {msg.fileName}
                  </div>
                )}
                {msg.content}
                {msg.importData && renderImportPreview(msg)}
              </div>
              {msg.role === 'user' && (
                <Avatar
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#87d068', marginLeft: 8, flexShrink: 0 }}
                />
              )}
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8 }} />
              <Spin size="small" />
              <span style={{ marginLeft: 8, color: '#999' }}>AI正在{attachedFile ? '分析文件' : '思考'}...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 快捷指令 */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0' }}>
          <Space wrap size={8}>
            {quickCommands.map((cmd) => (
              <Button
                key={cmd.key}
                size="small"
                icon={cmd.icon}
                onClick={() => handleQuickCommand(cmd)}
                style={{ borderRadius: 16 }}
              >
                {cmd.label}
              </Button>
            ))}
          </Space>
        </div>

        {/* 输入区 */}
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          {attachedFile && (
            <div style={{
              marginBottom: 8,
              padding: '6px 12px',
              background: '#f6f6f6',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <Space>
                <PaperClipOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontSize: 13 }}>{attachedFile.name}</span>
                <Tag style={{ fontSize: 11 }}>
                  {attachedFile.size > 1024 * 1024
                    ? `${(attachedFile.size / 1024 / 1024).toFixed(1)}MB`
                    : `${(attachedFile.size / 1024).toFixed(1)}KB`}
                </Tag>
              </Space>
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => setAttachedFile(null)}
                danger
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              icon={<PaperClipOutlined />}
              onClick={handleFileSelect}
              title="上传文件"
              style={{ flexShrink: 0 }}
            />
            <Input.TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={attachedFile ? `添加导入指令（如"导入为岗位需求"），或直接发送自动识别` : '输入消息，按 Enter 发送，Shift+Enter 换行'}
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={attachedFile ? <ImportOutlined /> : <SendOutlined />}
              onClick={() => handleSend()}
              loading={sending}
              style={{ alignSelf: 'flex-end', flexShrink: 0 }}
            >
              {attachedFile ? '智能导入' : '发送'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 导入项目选择弹窗 */}
      <Modal
        title="选择导入项目"
        open={importModalVisible}
        onOk={handleConfirmImport}
        onCancel={() => { setImportModalVisible(false); setImportModalData(null); }}
        okText="确认导入"
        cancelText="取消"
        okButtonProps={{ disabled: !selectedProjectId }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            {importModalData?.importData?.type === 'position' ? '岗位需求' : '候选人推荐'}，
            共 {importModalData?.importData?.items?.length || 0} 条数据
          </div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>请选择所属项目：</div>
          <Select
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            placeholder="请选择项目"
            style={{ width: '100%' }}
            size="large"
            options={projectList.map((p: any) => ({ value: p.id, label: p.name }))}
            showSearch
            optionFilterProp="label"
          />
        </div>
      </Modal>
    </div>
  );
}
