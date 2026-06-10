import { useEffect, useState } from 'react';
import { Card, List, Modal, Form, Input, Button, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getNotices, createNotice, deleteNotice } from '../api/notice';
import { useUserStore } from '../stores/user';

export default function NoticeBoard() {
  const user = useUserStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    try {
      setLoading(true);
      const res: any = await getNotices();
      const data = res.data || res || [];
      // Sort by date, newest first
      data.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setNotices(data);
    } catch (err: any) {
      message.error(err.message || '加载公告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createNotice(values);
      message.success('公告发布成功');
      setModalOpen(false);
      form.resetFields();
      loadNotices();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotice(id);
      message.success('公告已删除');
      loadNotices();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>通知公告</h2>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
            发布公告
          </Button>
        )}
      </div>

      <List
        loading={loading}
        dataSource={notices}
        renderItem={(item: any) => (
          <List.Item style={{ marginBottom: 12 }}>
            <Card
              style={{ width: '100%', borderRadius: 8 }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{item.title}</h3>
                    <Tag color="blue">公告</Tag>
                  </div>
                  <div style={{ color: '#595959', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{item.content}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                    {item.authorName || item.author || '系统'} · {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}
                  </div>
                </div>
                {isAdmin && (
                  <Popconfirm title="确定删除此公告？" onConfirm={() => handleDelete(item.id)} okText="确定" cancelText="取消">
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            </Card>
          </List.Item>
        )}
        locale={{ emptyText: '暂无公告' }}
      />

      <Modal
        title="发布公告"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="请输入公告内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
