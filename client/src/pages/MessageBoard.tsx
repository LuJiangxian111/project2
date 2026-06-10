import { useEffect, useState } from 'react';
import { Card, List, Modal, Form, Input, Button, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons';
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

  // 回复相关
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res: any = await getMessages();
      const data = res.data || res || [];
      data.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      // 排序回复按时间正序
      data.forEach((msg: any) => {
        if (msg.replies) {
          msg.replies.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
      });
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

  const handleReply = async (parentId: number) => {
    if (!replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }
    try {
      setReplySubmitting(true);
      await createMessage({
        nickname: user?.nickname || user?.name || user?.username || '',
        content: replyContent,
        parentId,
      });
      message.success('回复成功');
      setReplyingTo(null);
      setReplyContent('');
      loadMessages();
    } catch {
      message.error('回复失败');
    } finally {
      setReplySubmitting(false);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#8c8c8c', fontSize: 13 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}
                    </span>
                    <Button
                      type="link"
                      size="small"
                      icon={<MessageOutlined />}
                      style={{ padding: 0, fontSize: 13 }}
                      onClick={() => {
                        setReplyingTo(replyingTo === item.id ? null : item.id);
                        setReplyContent('');
                      }}
                    >
                      回复
                    </Button>
                    {isAdmin && (
                      <Popconfirm title="确定删除此留言？" onConfirm={() => handleDelete(item.id)} okText="确定" cancelText="取消">
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{ padding: 0, fontSize: 13 }}>
                          删除
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              </div>

              {/* 回复列表 */}
              {item.replies && item.replies.length > 0 && (
                <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid #f0f0f0' }}>
                  {item.replies.map((reply: any) => (
                    <div key={reply.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <strong style={{ fontSize: 13 }}>{reply.nickname || '匿名用户'}</strong>
                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                          {reply.createdAt ? new Date(reply.createdAt).toLocaleString('zh-CN') : ''}
                        </span>
                        {isAdmin && (
                          <Popconfirm title="确定删除此回复？" onConfirm={() => handleDelete(reply.id)} okText="确定" cancelText="取消">
                            <Button type="link" danger size="small" icon={<DeleteOutlined />} style={{ padding: 0, fontSize: 12 }} />
                          </Popconfirm>
                        )}
                      </div>
                      <div style={{ color: '#595959', fontSize: 13, whiteSpace: 'pre-wrap' }}>{reply.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 回复输入框 */}
              {replyingTo === item.id && (
                <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Input.TextArea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="输入回复内容..."
                      rows={2}
                      style={{ flex: 1 }}
                      onPressEnter={(e) => {
                        if (!e.shiftKey) {
                          e.preventDefault();
                          handleReply(item.id);
                        }
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Button
                        type="primary"
                        size="small"
                        loading={replySubmitting}
                        onClick={() => handleReply(item.id)}
                      >
                        发送
                      </Button>
                      <Button
                        size="small"
                        onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
