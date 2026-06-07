import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Row, Col, Typography, Select } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined, TeamOutlined, SafetyOutlined } from '@ant-design/icons';
import { useUserStore } from '../stores/user';
import { register as registerApi } from '../api/auth';

const { Title, Paragraph } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('hr');
  const navigate = useNavigate();
  const login = useUserStore((s) => s.login);

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; password: string; name: string; role: string; adminKey?: string }) => {
    try {
      setLoading(true);
      const payload: any = { ...values };
      if (values.role !== 'admin') {
        delete payload.adminKey;
      }
      await registerApi(payload);
      message.success('注册成功，请登录');
      setIsRegister(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Row gutter={48} align="middle" style={{ maxWidth: 900, width: '100%', padding: '0 24px' }}>
        <Col xs={0} md={14}>
          <div style={{ color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <RobotOutlined style={{ fontSize: 48, marginRight: 16 }} />
              <Title level={2} style={{ color: '#fff', margin: 0 }}>
                AI智能化岗位需求广场
              </Title>
            </div>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 1.8 }}>
              基于 AI 技术的智能化项目岗位需求管理平台，为您提供智能简历解析、岗位匹配分析、
              面试问题生成、招聘风险预警等全方位 AI 赋能服务，让招聘更高效、更精准。
            </Paragraph>
            <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
              {['智能匹配', '风险分析', '简历解析', '面试助手'].map((item) => (
                <div
                  key={item}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    padding: '12px 20px',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col xs={24} md={10}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <RobotOutlined style={{ fontSize: 40, color: '#667eea' }} />
              <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
                {isRegister ? '注册账号' : '欢迎登录'}
              </Title>
              <Paragraph type="secondary">
                {isRegister ? '创建您的账号以使用平台' : '请输入您的账号和密码'}
              </Paragraph>
            </div>

            {isRegister ? (
              <Form onFinish={handleRegister} size="large">
                <Form.Item name="username" rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                ]}>
                  <Input prefix={<UserOutlined />} placeholder="用户名" />
                </Form.Item>
                <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
                  <Input prefix={<TeamOutlined />} placeholder="姓名" />
                </Form.Item>
                <Form.Item name="password" rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                </Form.Item>
                <Form.Item name="role" initialValue="hr" rules={[{ required: true, message: '请选择角色' }]}>
                  <Select
                    placeholder="选择角色"
                    onChange={(val) => setSelectedRole(val)}
                    options={[
                      { value: 'admin', label: '管理员' },
                      { value: 'hr', label: 'HR' },
                      { value: 'pm', label: '项目经理' },
                      { value: 'interviewer', label: '面试官' },
                    ]}
                  />
                </Form.Item>
                {selectedRole === 'admin' && (
                  <Form.Item
                    name="adminKey"
                    label="管理员注册密码"
                    rules={[{ required: true, message: '请输入管理员注册密码' }]}
                  >
                    <Input.Password prefix={<SafetyOutlined />} placeholder="请输入管理员注册密码" />
                  </Form.Item>
                )}
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{
                      height: 44,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                    }}
                  >
                    注 册
                  </Button>
                </Form.Item>
                <div style={{ textAlign: 'center' }}>
                  <a onClick={() => setIsRegister(false)}>已有账号？返回登录</a>
                </div>
              </Form>
            ) : (
              <Form onFinish={handleLogin} size="large">
                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input prefix={<UserOutlined />} placeholder="用户名" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{
                      height: 44,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                    }}
                  >
                    登 录
                  </Button>
                </Form.Item>
                <div style={{ textAlign: 'center' }}>
                  <a onClick={() => setIsRegister(true)}>没有账号？立即注册</a>
                </div>
              </Form>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
