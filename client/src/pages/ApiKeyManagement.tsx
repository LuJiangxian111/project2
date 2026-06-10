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
              key: 'api-list',
              label: '接口列表',
              children: (
                <div style={{ lineHeight: 2 }}>
                  <Title level={5}>项目管理</Title>
                  <Paragraph><Text code>GET</Text> /projects - 获取项目列表</Paragraph>
                  <Paragraph><Text code>GET</Text> /projects/:id - 获取项目详情</Paragraph>
                  <Paragraph><Text code>POST</Text> /projects - 创建项目</Paragraph>
                  <Paragraph><Text code>PUT</Text> /projects/:id - 更新项目</Paragraph>
                  <Paragraph><Text code>DELETE</Text> /projects/:id - 删除项目</Paragraph>

                  <Title level={5}>岗位管理</Title>
                  <Paragraph><Text code>GET</Text> /positions - 获取岗位列表</Paragraph>
                  <Paragraph><Text code>GET</Text> /positions/:id - 获取岗位详情</Paragraph>
                  <Paragraph><Text code>POST</Text> /positions - 创建岗位</Paragraph>
                  <Paragraph><Text code>POST</Text> /positions/batch-import - 批量导入岗位</Paragraph>
                  <Paragraph><Text code>PUT</Text> /positions/:id - 更新岗位</Paragraph>
                  <Paragraph><Text code>DELETE</Text> /positions/:id - 删除岗位</Paragraph>

                  <Title level={5}>岗位候选人</Title>
                  <Paragraph><Text code>GET</Text> /positions/:id/candidates - 获取岗位候选人</Paragraph>
                  <Paragraph><Text code>POST</Text> /positions/:id/candidates - 添加候选人到岗位</Paragraph>
                  <Paragraph><Text code>POST</Text> /positions/:id/candidates/batch-import - 批量导入候选人</Paragraph>
                  <Paragraph><Text code>DELETE</Text> /positions/:positionId/candidates/:cpId - 移除候选人</Paragraph>
                  <Paragraph><Text code>POST</Text> /positions/:id/candidates/batch-remove - 批量移除候选人</Paragraph>
                  <Paragraph><Text code>PUT</Text> /candidate-position/:cpId/status - 更新候选人状态</Paragraph>

                  <Title level={5}>候选人管理</Title>
                  <Paragraph><Text code>GET</Text> /candidates - 获取候选人列表</Paragraph>
                  <Paragraph><Text code>GET</Text> /candidates/:id - 获取候选人详情</Paragraph>
                  <Paragraph><Text code>POST</Text> /candidates - 创建候选人</Paragraph>
                  <Paragraph><Text code>PUT</Text> /candidates/:id - 更新候选人</Paragraph>
                  <Paragraph><Text code>DELETE</Text> /candidates/:id - 删除候选人</Paragraph>

                  <Title level={5}>AI 智能助手（完整功能）</Title>
                  <Paragraph><Text code>POST</Text> /ai/agent-chat - AI Agent对话（支持所有工具）</Paragraph>
                  <Paragraph><Text code>POST</Text> /ai/agent-chat-with-file - AI Agent多文件对话</Paragraph>
                  <Paragraph><Text code>POST</Text> /ai/chat - AI 基础对话</Paragraph>
                  <Paragraph><Text code>POST</Text> /ai/match - AI 候选人匹配</Paragraph>
                  <Paragraph><Text code>POST</Text> /ai/analyze-risk - AI 风险分析</Paragraph>
                  <Paragraph><Text code>POST</Text> /ai/generate-report - AI 生成报告</Paragraph>

                  <Title level={5}>面试管理</Title>
                  <Paragraph><Text code>GET</Text> /interviews - 获取面试列表</Paragraph>
                  <Paragraph><Text code>POST</Text> /interviews - 创建面试</Paragraph>

                  <Title level={5}>数据统计</Title>
                  <Paragraph><Text code>GET</Text> /dashboard/stats - 获取仪表盘统计</Paragraph>
                </div>
              ),
            },
            {
              key: 'curl',
              label: 'cURL 示例',
              children: (
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
{`# ===== 项目管理 =====
# 获取项目列表
curl -X GET ${baseUrl}/projects \\
  -H "x-api-key: YOUR_API_KEY"

# 创建项目
curl -X POST ${baseUrl}/projects \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"新项目","description":"项目描述"}'

# ===== 岗位管理 =====
# 获取岗位列表
curl -X GET ${baseUrl}/positions \\
  -H "x-api-key: YOUR_API_KEY"

# 批量导入岗位
curl -X POST ${baseUrl}/positions/batch-import \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":1,"items":[{"positionDuty":"Java开发","department":"技术部"}]}'

# ===== 候选人管理 =====
# 创建候选人
curl -X POST ${baseUrl}/candidates \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"张三","contactPhone":"13800138000"}'

# 添加候选人到岗位
curl -X POST ${baseUrl}/positions/1/candidates \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"candidateId":1}'

# 批量导入候选人到岗位
curl -X POST ${baseUrl}/positions/1/candidates/batch-import \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[{"name":"张三","contactPhone":"13800138000"}]}'

# 更新候选人状态
curl -X PUT ${baseUrl}/candidate-position/1/status \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"interview_passed"}'

# 移除候选人
curl -X DELETE ${baseUrl}/positions/1/candidates/1 \\
  -H "x-api-key: YOUR_API_KEY"

# ===== AI Agent（完整功能）=====
# AI Agent 对话（支持搜索、导入、导出、状态更新等所有工具）
curl -X POST ${baseUrl}/ai/agent-chat \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"搜索需求编号R2508209923的岗位，并将候选人张三的状态改为面试通过"}'

# AI Agent 多轮对话
curl -X POST ${baseUrl}/ai/agent-chat \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"有哪些项目"},{"role":"assistant","content":"当前有3个项目..."},{"role":"user","content":"第一个项目有哪些岗位"}]}'

# AI Agent 上传文件分析
curl -X POST ${baseUrl}/ai/agent-chat-with-file \\
  -H "x-api-key: YOUR_API_KEY" \\
  -F "files=@candidates.xlsx" \\
  -F 'messages=[{"role":"user","content":"帮我把这些候选人导入到岗位1"}]'

# AI 匹配分析
curl -X POST ${baseUrl}/ai/match \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"candidateId":1,"positionId":1}'

# ===== 数据统计 =====
curl -X GET ${baseUrl}/dashboard/stats \\
  -H "x-api-key: YOUR_API_KEY"`}
                </pre>
              ),
            },
            {
              key: 'python',
              label: 'Python 示例',
              children: (
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
{`import requests

API_BASE = "${baseUrl}"
API_KEY = "YOUR_API_KEY"
headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

# ===== 项目管理 =====
resp = requests.get(f"{API_BASE}/projects", headers=headers)
projects = resp.json()

resp = requests.post(f"{API_BASE}/projects", headers=headers,
    json={"name": "新项目", "description": "项目描述"})

# ===== 岗位管理 =====
resp = requests.get(f"{API_BASE}/positions", headers=headers)

# 批量导入岗位
resp = requests.post(f"{API_BASE}/positions/batch-import", headers=headers,
    json={"projectId": 1, "items": [{"positionDuty": "Java开发", "department": "技术部"}]})

# ===== 候选人管理 =====
# 创建候选人
resp = requests.post(f"{API_BASE}/candidates", headers=headers,
    json={"name": "张三", "contactPhone": "13800138000"})

# 添加候选人到岗位
resp = requests.post(f"{API_BASE}/positions/1/candidates", headers=headers,
    json={"candidateId": 1})

# 批量导入候选人
resp = requests.post(f"{API_BASE}/positions/1/candidates/batch-import",
    headers=headers,
    json={"items": [{"name": "张三", "contactPhone": "13800138000"}]})

# 更新候选人状态
resp = requests.put(f"{API_BASE}/candidate-position/1/status", headers=headers,
    json={"status": "interview_passed"})

# ===== AI Agent（完整功能）=====
# AI Agent 对话（支持搜索、导入、导出、状态更新等所有工具）
resp = requests.post(f"{API_BASE}/ai/agent-chat", headers=headers,
    json={"message": "搜索需求编号R2508209923的岗位，并将候选人张三的状态改为面试通过"})

# AI Agent 多轮对话
resp = requests.post(f"{API_BASE}/ai/agent-chat", headers=headers,
    json={"messages": [
        {"role": "user", "content": "有哪些项目"},
        {"role": "assistant", "content": "当前有3个项目..."},
        {"role": "user", "content": "第一个项目有哪些岗位"}
    ]})

# AI Agent 上传文件
with open("candidates.xlsx", "rb") as f:
    resp = requests.post(f"{API_BASE}/ai/agent-chat-with-file",
        headers={"x-api-key": API_KEY},
        files={"files": f},
        data={"messages": '[{"role":"user","content":"帮我把这些候选人导入到岗位1"}]'})

# AI 匹配分析
resp = requests.post(f"{API_BASE}/ai/match", headers=headers,
    json={"candidateId": 1, "positionId": 1})

# ===== 数据统计 =====
resp = requests.get(f"{API_BASE}/dashboard/stats", headers=headers)`}
                </pre>
              ),
            },
            {
              key: 'javascript',
              label: 'JavaScript 示例',
              children: (
                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
{`const API_BASE = "${baseUrl}";
const API_KEY = "YOUR_API_KEY";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };

// ===== 项目管理 =====
const projects = await fetch(API_BASE + "/projects", { headers }).then(r => r.json());

const newProject = await fetch(API_BASE + "/projects", {
  method: "POST", headers,
  body: JSON.stringify({ name: "新项目", description: "项目描述" }),
}).then(r => r.json());

// ===== 岗位管理 =====
const positions = await fetch(API_BASE + "/positions", { headers }).then(r => r.json());

// 批量导入岗位
await fetch(API_BASE + "/positions/batch-import", {
  method: "POST", headers,
  body: JSON.stringify({ projectId: 1, items: [{ positionDuty: "Java开发", department: "技术部" }] }),
}).then(r => r.json());

// ===== 候选人管理 =====
// 创建候选人
await fetch(API_BASE + "/candidates", {
  method: "POST", headers,
  body: JSON.stringify({ name: "张三", contactPhone: "13800138000" }),
}).then(r => r.json());

// 添加候选人到岗位
await fetch(API_BASE + "/positions/1/candidates", {
  method: "POST", headers,
  body: JSON.stringify({ candidateId: 1 }),
}).then(r => r.json());

// 更新候选人状态
await fetch(API_BASE + "/candidate-position/1/status", {
  method: "PUT", headers,
  body: JSON.stringify({ status: "interview_passed" }),
}).then(r => r.json());

// ===== AI Agent（完整功能）=====
// AI Agent 对话（支持搜索、导入、导出、状态更新等所有工具）
const aiResult = await fetch(API_BASE + "/ai/agent-chat", {
  method: "POST", headers,
  body: JSON.stringify({ message: "搜索需求编号R2508209923的岗位，并将候选人张三的状态改为面试通过" }),
}).then(r => r.json());

// AI Agent 多轮对话
const aiResult2 = await fetch(API_BASE + "/ai/agent-chat", {
  method: "POST", headers,
  body: JSON.stringify({ messages: [
    { role: "user", content: "有哪些项目" },
    { role: "assistant", content: "当前有3个项目..." },
    { role: "user", content: "第一个项目有哪些岗位" },
  ]}),
}).then(r => r.json());

// AI Agent 上传文件
const formData = new FormData();
formData.append("files", fileInput.files[0]);
formData.append("messages", JSON.stringify([{ role: "user", content: "帮我把这些候选人导入到岗位1" }]));
const aiFileResult = await fetch(API_BASE + "/ai/agent-chat-with-file", {
  method: "POST",
  headers: { "x-api-key": API_KEY },
  body: formData,
}).then(r => r.json());

// ===== 数据统计 =====
const stats = await fetch(API_BASE + "/dashboard/stats", { headers }).then(r => r.json());`}
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
