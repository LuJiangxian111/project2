import { useState } from 'react';
import { Button, Modal, List, Avatar, Input, Spin, message as antMessage, Tag } from 'antd';
import { ShareAltOutlined, TeamOutlined } from '@ant-design/icons';
import { getMyGroups, sendMessage } from '../api/discussion';

interface ShareToDiscussionProps {
  referenceType: 'position' | 'candidate' | 'interview';
  referenceId: number;
  referenceData: any;
  label: string;
}

export default function ShareToDiscussion({ referenceType, referenceId, referenceData, label }: ShareToDiscussionProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const typeLabels: Record<string, string> = {
    position: '岗位',
    candidate: '候选人',
    interview: '面试安排',
  };
  const typeColors: Record<string, string> = {
    position: '#1890ff',
    candidate: '#52c41a',
    interview: '#722ed1',
  };

  const handleOpen = async () => {
    setOpen(true);
    setSelectedGroupId(null);
    setComment('');
    try {
      setLoading(true);
      const res: any = await getMyGroups();
      const data = res.data || res || [];
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedGroupId) return;
    try {
      setSending(true);
      const content = comment.trim() || `分享了${typeLabels[referenceType]}：${label}`;
      await sendMessage(selectedGroupId, {
        content,
        referenceType,
        referenceId,
        referenceData,
      });
      antMessage.success('分享成功');
      setOpen(false);
      setComment('');
    } catch (err: any) {
      antMessage.error(err?.response?.data?.message || '分享失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button icon={<ShareAltOutlined />} onClick={handleOpen}>
        分享到讨论组
      </Button>
      <Modal
        title="分享到讨论组"
        open={open}
        onOk={handleShare}
        onCancel={() => setOpen(false)}
        okText="分享"
        okButtonProps={{ disabled: !selectedGroupId, loading: sending }}
        width={520}
        destroyOnClose
      >
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6f6f6', borderRadius: 6 }}>
          <Tag color={typeColors[referenceType]}>{typeLabels[referenceType]}</Tag>
          <span style={{ fontWeight: 500 }}>{label}</span>
        </div>
        <Input.TextArea
          placeholder="添加留言（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ marginBottom: 12 }}
        />
        <Spin spinning={loading}>
          <List
            dataSource={groups}
            style={{ maxHeight: 300, overflow: 'auto' }}
            locale={{ emptyText: '暂无讨论组' }}
            renderItem={(group: any) => (
              <List.Item
                onClick={() => setSelectedGroupId(group.id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedGroupId === group.id ? '#e6f4ff' : 'transparent',
                  borderRadius: 6,
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      icon={<TeamOutlined />}
                      style={{ backgroundColor: selectedGroupId === group.id ? '#1890ff' : '#87d068' }}
                    />
                  }
                  title={group.name}
                  description={group.project?.name || ''}
                />
                {selectedGroupId === group.id && <Tag color="blue">已选</Tag>}
              </List.Item>
            )}
          />
        </Spin>
      </Modal>
    </>
  );
}
