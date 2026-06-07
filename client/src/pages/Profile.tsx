import { useEffect, useState, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Upload,
  Modal,
  message,
  Descriptions,
  Row,
  Col,
  Divider,
} from 'antd';
import { UserOutlined, CameraOutlined, LockOutlined } from '@ant-design/icons';
import { useUserStore } from '../stores/user';
import { getProfile, updateProfile, changePassword, uploadAvatar } from '../api/auth';

const API_BASE = 'http://localhost:3000';

export default function Profile() {
  const { user, setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [savingPassword, setSavingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res: any = await getProfile();
      const profile = res.data || res;
      setUser(profile);
      profileForm.setFieldsValue({
        username: profile.username,
        name: profile.name,
        nickname: profile.nickname,
        gender: profile.gender,
        phone: profile.phone,
        email: profile.email,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    try {
      const values = await profileForm.validateFields();
      if (!user?.id) return;
      const res: any = await updateProfile(user.id, values);
      message.success('个人信息更新成功');
      const updated = res.data || res;
      setUser(updated);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '更新失败');
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      message.error('头像文件不能超过5MB');
      return;
    }
    try {
      const res: any = await uploadAvatar(user!.id, file);
      const avatarUrl = res.data?.url || res.url;
      message.success('头像更新成功');
      // 更新用户信息
      const profileRes: any = await getProfile();
      const profile = profileRes.data || profileRes;
      setUser(profile);
    } catch (err: any) {
      message.error(err.message || '头像上传失败');
    }
    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的新密码不一致');
        return;
      }
      setSavingPassword(true);
      await changePassword(user!.id, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || err.message || '密码修改失败');
    } finally {
      setSavingPassword(false);
    }
  };

  const avatarSrc = user?.avatar
    ? user.avatar.startsWith('http')
      ? user.avatar
      : `${API_BASE}${user.avatar}`
    : undefined;

  const roleMap: Record<string, string> = {
    admin: '管理员',
    hr: 'HR',
    pm: '项目经理',
    interviewer: '面试官',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 头像和基本信息展示 */}
      <Card style={{ borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handleAvatarClick}>
            <Avatar
              size={96}
              icon={<UserOutlined />}
              src={avatarSrc}
              style={{ backgroundColor: '#1677ff' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
              }}
            >
              <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{user?.nickname || user?.name || user?.username}</h2>
            <span style={{ color: '#999' }}>
              @{user?.username} · {roleMap[user?.role || ''] || user?.role}
            </span>
          </div>
        </div>
      </Card>

      {/* 个人信息编辑 */}
      <Card title="个人信息" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Form form={profileForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="用户名">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="姓名">
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nickname" label="昵称">
                <Input placeholder="请输入昵称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label="性别">
                <Input placeholder="如：男/女" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="电话号码">
                <Input placeholder="请输入电话号码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" onClick={handleProfileSave}>
              保存信息
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 安全设置 */}
      <Card title="安全设置" style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500 }}>登录密码</div>
            <div style={{ color: '#999', fontSize: 13 }}>定期更换密码有助于保护账号安全</div>
          </div>
          <Button icon={<LockOutlined />} onClick={() => setPasswordModalVisible(true)}>
            修改密码
          </Button>
        </div>
      </Card>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        confirmLoading={savingPassword}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[
              { required: true, message: '请确认新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
