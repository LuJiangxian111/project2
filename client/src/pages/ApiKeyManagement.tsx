import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  message,
  Typography,
  Popconfirm,
  Alert,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  KeyOutlined,
  CopyOutlined,
  DeleteOutlined,
  StopOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function ApiKeyManagement() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ apiKey: string; keyPrefix: string } | null>(null);
  const [form] = Form.useForm();

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res: any = await import('../api/api-key').then((m) => m.listApiKeys());
      setKeys(res.data || res || []);
    } catch {
      message.error('加载 API Key 列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async (values: { name: string }) => {
    try {
      const res: any = await import('../api/api-key').then((m) => m.createApiKey(values.name));
      const data = res.data || res;
      setNewKeyData(data);
      setCreateModalVisible(false);
      form.resetFields();
      loadKeys();
    } catch {
      message.error('创建 API Key 失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await import('../api/api-key').then((m) => m.deleteApiKey(id));
      message.success('API Key 已删除');
      loadKeys();
    } catch {
      message.error('删除失败');
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await import('../api/api-key').then((m) => m.revokeApiKey(id));
      message.success('API Key 已停用');
      loadKeys();
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

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
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
      render: (active: boolean) =>
        active ? <Tag color="green">有效</Tag> : <Tag color="red">已停用</Tag>,
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '从未使用'),
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
            <Popconfirm title="确认停用此 API Key？" onConfirm={() => handleRevoke(record.id)}>
              <Button size="small" icon={<StopOutlined />} danger>
                停用
              </Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除此 API Key？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <KeyOutlined />
            <span>API Key 管理</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建 API Key
          </Button>
        }
      >
        <Alert
          message="API Key 用于让外部 AI 或程序通过 API 直接操作本平台"
          description="创建 API Key 后，外部程序可以通过 HTTP 请求调用平台的所有功能，包括项目管理、岗位管理、候选人管理等。请妥善保管您的 API Key。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={keys}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* API 使用文档 */}
      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>外部 API 使用文档</span>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Paragraph>
          外部 AI 或程序可以通过以下 API 接口操作平台。所有请求需要在 Header 中携带
          <Text code>x-api-key</Text> 进行认证。
        </Paragraph>

        <Tabs
          items={[
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

# 获取岗位列表
curl -X GET ${baseUrl}/positions \\
  -H "x-api-key: YOUR_API_KEY"

# 创建候选人
curl -X POST ${baseUrl}/candidates \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"张三","phone":"13800138000"}'

# AI 对话
curl -X POST ${baseUrl}/ai/chat \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"帮我分析当前招聘情况"}'

# AI 风险分析
curl -X POST ${baseUrl}/ai/analyze-risk \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}
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
projects = resp.json()

# 创建项目
resp = requests.post(f"{API_BASE}/projects", headers=headers, 
    json={"name": "新项目", "description": "项目描述"})

# 获取岗位列表
resp = requests.get(f"{API_BASE}/positions", headers=headers)

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

// 创建项目
const newProject = await fetch(API_BASE + "/projects", {
  method: "POST", headers,
  body: JSON.stringify({ name: "新项目", description: "项目描述" }),
}).then(r => r.json());

// AI 对话
const aiResult = await fetch(API_BASE + "/ai/chat", {
  method: "POST", headers,
  body: JSON.stringify({ message: "帮我分析当前招聘情况" }),
}).then(r => r.json());`}
                </pre>
              ),
            },
          ]}
        />
      </Card>

      {/* 创建 API Key 弹窗 */}
      <Modal
        title="创建 API Key"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入 API Key 名称' }]}
          >
            <Input placeholder="例如：ChatGPT 集成" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 显示新创建的 API Key */}
      <Modal
        title="API Key 创建成功"
        open={!!newKeyData}
        onCancel={() => setNewKeyData(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setNewKeyData(null)}>
            我已保存
          </Button>,
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
