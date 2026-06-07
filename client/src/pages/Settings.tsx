import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Spin } from 'antd';
import { useUserStore } from '../stores/user';
import { getProfile } from '../api/auth';
import request from '../api/request';

export default function Settings() {
  const { user, setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [aiForm] = Form.useForm();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadProfile();
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

  return (
    <Spin spinning={loading}>
      <Card title="AI配置" style={{ borderRadius: 8 }}>
        <Form form={aiForm} layout="vertical" style={{ maxWidth: 480 }}>
          <Form.Item
            name="llmApiKey"
            label="LLM API Key"
            extra="API密钥将加密存储，不会明文显示"
          >
            <Input.Password placeholder="请输入LLM API Key" />
          </Form.Item>
          <Form.Item
            name="llmBaseUrl"
            label="API Base URL"
            extra="如：https://api.openai.com/v1"
          >
            <Input placeholder="请输入API Base URL" />
          </Form.Item>
          <Form.Item
            name="llmModel"
            label="模型名称"
            extra="如：gpt-4, claude-3-opus-20240229 等"
          >
            <Input placeholder="请输入模型名称" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAISave} style={{ marginRight: 12 }}>
              保存配置
            </Button>
            <Button onClick={handleTestConnection} loading={testing}>
              测试连接
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Spin>
  );
}
