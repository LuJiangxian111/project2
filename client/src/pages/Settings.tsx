import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Spin, Tabs, Table, Modal, Tag, Space, Popconfirm, Alert, Typography } from 'antd';
import {
  PlusOutlined,
  KeyOutlined,
  CopyOutlined,
  DeleteOutlined,
  StopOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useUserStore } from '../stores/user';
import { getProfile } from '../api/auth';
import request from '../api/request';

const { Paragraph, Text } = Typography;

export default function Settings() {
  const { user, setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [aiForm] = Form.useForm();
  const [testing, setTesting] = useState(false);

  // API Key 相关
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ apiKey: string; keyPrefix: string } | null>(null);
  const [keyForm] = Form.useForm();

  useEffect(() => {
    loadProfile();
    loadApiKeys();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res: any = await getProfile();
      const profile = res.data || res;
      setUser(profile);
      aiForm.setFieldsValue({
        llmApiKey: profile.llmApiKey,
        llmBaseUrl: profile.llmBaseUrl,
        llmModel: profile.llmModel,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAISave = async () => {
    try {
      const values = await aiForm.validateFields();
      if (!user?.id) return;
      await request.put(`/users/${user.id}/llm-config`, values);
      message.success('AI配置更新成功');
      loadProfile();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '更新失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const values = await aiForm.validateFields();
      if (!user?.id) return;
      await request.put(`/users/${user.id}/llm-config`, values);
      message.success('连接测试成功');
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  // API Key 方法
  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const res: any = await import('../api/api-key').then((m) => m.listApiKeys());
      setApiKeys(res.data || res || []);
    } catch {
      message.error('加载 API Key 列表失败');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleCreateKey = async (values: { name: string }) => {
    try {
      const res: any = await import('../api/api-key').then((m) => m.createApiKey(values.name));
      const data = res.data || res;
      setNewKeyData(data);
      setCreateModalVisible(false);
      keyForm.resetFields();
      loadApiKeys();
    } catch {
      message.error('创建 API Key 失败');
    }
  };

  const handleDeleteKey = async (id: number) => {
    try {
      await import('../api/api-key').then((m) => m.deleteApiKey(id));
      message.success('API Key 已删除');
      loadApiKeys();
    } catch {
      message.error('删除失败');
    }
  };

  const handleRevokeKey = async (id: number) => {
    try {
      await import('../api/api-key').then((m) => m.revokeApiKey(id));
      message.success('API Key 已停用');
      loadApiKeys();
    } catch {
      message.error('停用失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const baseUrl = `${window.location.origin}/api/external`;

  const keyColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'Key 前缀',
      dataIndex: 'keyPrefix',
      key: 'keyPrefix',
      render: (prefix: string) => <Text code>{prefix}...</Text>,
    },
    {
      title: '状态',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => active ? <Tag color="green">有效</Tag> : <Tag color="red">已停用</Tag>,
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '从未使用',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.active && (
            <Popconfirm title="确认停用此 API Key？" onConfirm={() => handleRevokeKey(record.id)}>
              <Button size="small" icon={<StopOutlined />} danger>停用</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除此 API Key？" onConfirm={() => handleDeleteKey(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'ai',
      label: 'AI 配置',
      children: (
        <Spin spinning={loading}>
          <Form form={aiForm} layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item name="llmApiKey" label="LLM API Key" extra="API密钥将加密存储，不会明文显示">
              <Input.Password placeholder="请输入LLM API Key" />
            </Form.Item>
            <Form.Item name="llmBaseUrl" label="API Base URL" extra="如：https://api.openai.com/v1">
              <Input placeholder="请输入API Base URL" />
            </Form.Item>
            <Form.Item name="llmModel" label="模型名称" extra="如：gpt-4, claude-3-opus-20240229 等">
              <Input placeholder="请输入模型名称" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleAISave} style={{ marginRight: 12 }}>保存配置</Button>
              <Button onClick={handleTestConnection} loading={testing}>测试连接</Button>
            </Form.Item>
          </Form>
        </Spin>
      ),
    },
    {
      key: 'api-key',
      label: 'API Key 管理',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建 API Key
            </Button>
          </div>
          <Alert
            message="API Key 用于让外部 AI 或程序通过 API 直接操作本平台"
            description="创建 API Key 后，外部程序可以通过 HTTP 请求调用平台的所有功能。请妥善保管您的 API Key。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={keyColumns}
            dataSource={apiKeys}
            rowKey="id"
            loading={apiKeysLoading}
            pagination={false}
          />

          <Card
            title={<Space><ApiOutlined /><span>外部 API 使用文档</span></Space>}
            style={{ marginTop: 16 }}
          >
            <Paragraph>
              外部 AI 或程序可以通过以下 API 接口操作平台。所有请求需要在 Header 中携带
              <Text code>x-api-key</Text> 进行认证。
            </Paragraph>
            <Tabs items={[
              {
                key: 'curl',
                label: 'cURL',
                children: (
                  <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`# 获取项目列表
curl -X GET ${baseUrl}/projects \\
  -H "x-api-key: YOUR_API_KEY"

# 创建项目
curl -X POST ${baseUrl}/projects \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"新项目","description":"项目描述"}'

# AI 对话
curl -X POST ${baseUrl}/ai/chat \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"帮我分析当前招聘情况"}'`}
                  </pre>
                ),
              },
              {
                key: 'python',
                label: 'Python',
                children: (
                  <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`import requests

API_BASE = "${baseUrl}"
API_KEY = "YOUR_API_KEY"
headers = {"x-api-key": API_KEY}

# 获取项目列表
resp = requests.get(f"{API_BASE}/projects", headers=headers)

# 创建项目
resp = requests.post(f"{API_BASE}/projects", headers=headers,
    json={"name": "新项目", "description": "项目描述"})

# AI 对话
resp = requests.post(f"{API_BASE}/ai/chat", headers=headers,
    json={"message": "帮我分析当前招聘情况"})`}
                  </pre>
                ),
              },
              {
                key: 'javascript',
                label: 'JavaScript',
                children: (
                  <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
{`const API_BASE = "${baseUrl}";
const API_KEY = "YOUR_API_KEY";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };

// 获取项目列表
const projects = await fetch(API_BASE + "/projects", { headers })
  .then(r => r.json());

// AI 对话
const aiResult = await fetch(API_BASE + "/ai/chat", {
  method: "POST", headers,
  body: JSON.stringify({ message: "帮我分析当前招聘情况" }),
}).then(r => r.json());`}
                  </pre>
                ),
              },
            ]} />
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Tabs items={tabItems} />

      {/* 创建 API Key 弹窗 */}
      <Modal
        title="创建 API Key"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={keyForm} onFinish={handleCreateKey}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 API Key 名称' }]}>
            <Input placeholder="例如：ChatGPT 集成" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">创建</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 显示新创建的 API Key */}
      <Modal
        title="API Key 创建成功"
        open={!!newKeyData}
        onCancel={() => setNewKeyData(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setNewKeyData(null)}>我已保存</Button>,
        ]}
        closable={false}
        maskClosable={false}
      >
        <Alert
          message="请立即保存此 API Key，关闭后将无法再次查看！"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={newKeyData?.apiKey || ''}
          rows={3}
          readOnly
          style={{ fontFamily: 'monospace' }}
        />
        <Button
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(newKeyData?.apiKey || '')}
          style={{ marginTop: 8 }}
        >
          复制 API Key
        </Button>
      </Modal>
    </div>
  );
}
