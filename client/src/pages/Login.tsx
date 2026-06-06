import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Row, Col, Typography } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useUserStore } from '../stores/user';

const { Title, Paragraph } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useUserStore((s) => s.login);

  const handleSubmit = async (values: { username: string; password: string }) => {
    try {
      setLoading(true);
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.message || '登录失败');
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
                欢迎登录
              </Title>
              <Paragraph type="secondary">请输入您的账号和密码</Paragraph>
            </div>
            <Form onFinish={handleSubmit} size="large">
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
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
