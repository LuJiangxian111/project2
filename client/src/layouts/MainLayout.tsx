import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Breadcrumb, theme, Badge, Popover, List, Button, Modal, Form, Input, Tag, message, Popconfirm } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  ShopOutlined,
  TeamOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useUserStore } from '../stores/user';
import { getNotices, createNotice, deleteNotice } from '../api/notice';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/market', icon: <ShopOutlined />, label: '需求广场' },
  { key: '/candidates', icon: <TeamOutlined />, label: '候选人管理' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI助手' },
  { key: '/message-board', icon: <MessageOutlined />, label: '留言板' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const breadcrumbMap: Record<string, string> = {
  '/': '仪表盘',
  '/projects': '项目管理',
  '/market': '需求广场',
  '/candidates': '候选人管理',
  '/ai': 'AI助手',
  '/message-board': '留言板',
  '/settings': '系统设置',
  '/profile': '个人信息',
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser, token } = useUserStore();
  const { token: themeToken } = theme.useToken();

  // 通知公告相关
  const [notices, setNotices] = useState<any[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [hasNewNotice, setHasNewNotice] = useState(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeForm] = Form.useForm();
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const lastNoticeCountRef = useRef(0);
  const isAdmin = user?.role === 'admin';

  const loadNotices = async () => {
    try {
      setNoticeLoading(true);
      const res: any = await getNotices(user?.id);
      const data = res.data || res || [];
      data.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setNotices(data);
      // 检测是否有新公告
      if (lastNoticeCountRef.current > 0 && data.length > lastNoticeCountRef.current) {
        setHasNewNotice(true);
      }
      lastNoticeCountRef.current = data.length;
    } catch {
      // ignore
    } finally {
      setNoticeLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadNotices();
      const timer = setInterval(loadNotices, 30000); // 每30秒轮询
      return () => clearInterval(timer);
    }
  }, [user?.id]);

  const handleNoticeOpenChange = (open: boolean) => {
    setNoticeOpen(open);
    if (open) setHasNewNotice(false);
  };

  const handleCreateNotice = async () => {
    try {
      const values = await noticeForm.validateFields();
      setNoticeSubmitting(true);
      await createNotice(values);
      message.success('公告发布成功');
      setNoticeModalOpen(false);
      noticeForm.resetFields();
      loadNotices();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '发布失败');
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: number) => {
    try {
      await deleteNotice(id);
      message.success('公告已删除');
      loadNotices();
    } catch {
      message.error('删除失败');
    }
  };

  const noticeContent = (
    <div style={{ width: 360, maxHeight: 480, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>通知公告</span>
        {isAdmin && (
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setNoticeModalOpen(true); }}>
            发布
          </Button>
        )}
      </div>
      <List
        loading={noticeLoading}
        dataSource={notices}
        locale={{ emptyText: '暂无公告' }}
        renderItem={(item: any) => (
          <List.Item
            style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
            actions={isAdmin ? [
              <Popconfirm key="del" title="确定删除？" onConfirm={() => handleDeleteNotice(item.id)} okText="确定" cancelText="取消">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>,
            ] : undefined}
          >
            <List.Item.Meta
              title={<span style={{ fontSize: 14 }}>{item.title}</span>}
              description={
                <div>
                  <div style={{ color: '#595959', fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{item.content}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                    {item.authorName || item.author || '系统'} · {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  // 页面刷新时恢复用户信息
  useEffect(() => {
    if (token && !user) {
      import('../api/auth').then(({ getProfile }) => {
        getProfile().then((res: any) => {
          const u = res.data || res;
          setUser(u);
        }).catch(() => {});
      });
    }
  }, [token, user, setUser]);

  const pathSnippets = location.pathname.split('/').filter((i) => i);
  const breadcrumbItems = pathSnippets.map((_, index) => {
      const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
      return { title: breadcrumbMap[url] || pathSnippets[index], path: url };
    });

  const selectedKey = '/' + (pathSnippets[0] || '');
  const dropdownItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  const handleMenuClick = (info: { key: string }) => {
    navigate(info.key);
  };

  const handleDropdownClick = (info: { key: string }) => {
    if (info.key === 'logout') {
      logout();
      navigate('/login');
    } else if (info.key === 'profile') {
      navigate('/profile');
    } else if (info.key === 'settings') {
      navigate('/settings');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: themeToken.colorBgContainer,
          borderRight: `1px solid ${themeToken.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          }}
        >
          <RobotOutlined style={{ fontSize: 24, color: themeToken.colorPrimary }} />
          {!collapsed && (
            <span
              style={{
                marginLeft: 10,
                fontSize: 16,
                fontWeight: 600,
                color: themeToken.colorPrimary,
                whiteSpace: 'nowrap',
              }}
            >
              岗位需求广场
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: 'none' }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: themeToken.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 18, cursor: 'pointer', marginRight: 16 }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Breadcrumb
              items={[{ title: <a onClick={() => navigate('/')}>首页</a> }, ...breadcrumbItems.map((item) => ({
                title: <a onClick={() => navigate(item.path)}>{item.title}</a>,
              }))]}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Popover
              content={noticeContent}
              trigger="click"
              open={noticeOpen}
              onOpenChange={handleNoticeOpenChange}
              placement="bottomRight"
            >
              <Badge dot={hasNewNotice} offset={[-4, 4]} color="red">
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
              </Badge>
            </Popover>
            <Dropdown menu={{ items: dropdownItems, onClick: handleDropdownClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar
                  icon={<UserOutlined />}
                  src={user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `http://localhost:3000${user.avatar}`) : undefined}
                  style={{ backgroundColor: themeToken.colorPrimary }}
                />
                <span>{user?.nickname || user?.name || user?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: themeToken.colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>

      {/* 发布公告弹窗 */}
      <Modal
        title="发布公告"
        open={noticeModalOpen}
        onOk={handleCreateNotice}
        onCancel={() => setNoticeModalOpen(false)}
        confirmLoading={noticeSubmitting}
        destroyOnClose
      >
        <Form form={noticeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="请输入公告内容" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
