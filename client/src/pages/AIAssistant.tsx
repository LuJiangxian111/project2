import { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Card, Space, Avatar, Spin, message, Modal, Typography } from 'antd';
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
} from '@ant-design/icons';
import { chatWithAI } from '../api/ai';

const { Paragraph } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

export default function AIAssistant() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: '1', title: '新对话', messages: [], createdAt: new Date() },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
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
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 148px)', gap: 0 }}>
      {/* 左侧对话历史 */}
      <Card
        style={{ width: 240, borderRadius: '8px 0 0 8px', overflow: 'auto' }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} block onClick={handleNewSession}>
            新建对话
          </Button>
        </div>
        <List
          dataSource={sessions}
          renderItem={(session) => (
            <List.Item
              onClick={() => setActiveSessionId(session.id)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                background: session.id === activeSessionId ? '#e6f7ff' : 'transparent',
                borderLeft: session.id === activeSessionId ? '3px solid #1890ff' : '3px solid transparent',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {session.title}
              </div>
            </List.Item>
          )}
        />
      </Card>

      {/* 右侧对话区 */}
      <Card
        style={{ flex: 1, borderRadius: '0 8px 8px 0', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0 } }}
      >
        {/* 消息区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {activeSession?.messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#bfbfbf' }}>
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>AI智能助手</div>
              <div style={{ fontSize: 13 }}>我可以帮您进行简历解析、岗位匹配、风险分析等操作</div>
            </div>
          )}
          {activeSession?.messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  icon={<RobotOutlined />}
                  style={{ backgroundColor: '#1890ff', marginRight: 8, flexShrink: 0 }}
                />
              )}
              <div
                style={{
                  maxWidth: '70%',
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
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
              <span style={{ marginLeft: 8, color: '#999' }}>AI正在思考...</span>
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
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            loading={sending}
            style={{ alignSelf: 'flex-end' }}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
}
