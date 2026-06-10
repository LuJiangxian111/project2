import { useEffect, useState } from 'react';
import { Card, List, Modal, Form, Input, Button, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getMessages, createMessage, deleteMessage } from '../api/message-board';
import { useUserStore } from '../stores/user';

export default function MessageBoard() {
  const user = useUserStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res: any = await getMessages();
      const data = res.data || res || [];
      // Sort by date, newest first
      data.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setMessages(data);
    } catch (err: any) {
      message.error(err.message || '加载留言失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createMessage(values);
      message.success('留言成功');
      setModalOpen(false);
      form.resetFields();
      loadMessages();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '留言失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMessage(id);
      message.success('留言已删除');
      loadMessages();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>留言板</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          留言
        </Button>
      </div>

      <List
        loading={loading}
        dataSource={messages}
        renderItem={(item: any) => (
          <List.Item style={{ marginBottom: 12 }}>
            <Card
              style={{ width: '100%', borderRadius: 8 }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <strong>{item.nickname || '匿名用户'}</strong>
                  </div>
                  <div style={{ color: '#595959', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{item.content}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}
                  </div>
                </div>
                {isAdmin && (
                  <Popconfirm title="确定删除此留言？" onConfirm={() => handleDelete(item.id)} okText="确定" cancelText="取消">
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            </Card>
          </List.Item>
        )}
        locale={{ emptyText: '暂无留言' }}
      />

      <Modal
        title="留言"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nickname" label="昵称（选填）">
            <Input placeholder="不填则为匿名用户" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入留言内容' }]}>
            <Input.TextArea rows={4} placeholder="请输入留言内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
