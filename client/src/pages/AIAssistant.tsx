import { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Card, Space, Avatar, Spin, message, Modal, Typography, Tag, Popconfirm } from 'antd';
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
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { chatWithAI, chatWithFile } from '../api/ai';

const { Paragraph } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  fileName?: string;
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
        const sessions = parsed.map((s: any) => ({
          ...s,
          messages: Array.isArray(s.messages)
            ? s.messages.map((m: any) => ({
                ...m,
                role: m.role || 'assistant',
              }))
            : [],
        }));
        return { sessions, activeId: savedActiveId || sessions[0].id };
      }
    }
  } catch {
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

export default function AIAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions().sessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadSessions().activeId);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
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

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string, fileName?: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      fileName,
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

  const handleSend = async (text?: string) => {
    const content = text || inputValue.trim();

    // 有附件文件时，走文件分析流程
    if (attachedFile) {
      const file = attachedFile;
      const userMsg = content || `请分析这个文件`;
      setAttachedFile(null);
      setInputValue('');
      addMessage('user', userMsg, file.name);
      setSending(true);

      try {
        const res: any = await chatWithFile([{ role: 'user', content: userMsg }], file);
        const aiContent = res.data?.content || res.data?.message || res.data || res.content || res.message || 'AI回复解析失败';
        addMessage('assistant', typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent));
      } catch (err: any) {
        addMessage('assistant', '文件分析失败，请确认文件格式和AI配置后重试。');
      } finally {
        setSending(false);
      }
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
                <PaperClipOutlined style={{ marginRight: 4 }} />
                上传文件，我可以帮您分析文件内容
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
                {msg.fileName && (
                  <div style={{ marginBottom: 6, opacity: 0.8, fontSize: 12 }}>
                    <PaperClipOutlined style={{ marginRight: 4 }} />
                    {msg.fileName}
                  </div>
                )}
                {msg.content}
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
              placeholder={attachedFile ? '添加消息（如"请分析这个文件"），或直接发送' : '输入消息，按 Enter 发送，Shift+Enter 换行'}
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend()}
              loading={sending}
              style={{ alignSelf: 'flex-end', flexShrink: 0 }}
            >
              发送
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
