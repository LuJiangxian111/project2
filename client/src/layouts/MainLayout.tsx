import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Breadcrumb, theme } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  ShopOutlined,
  TeamOutlined,
  RobotOutlined,
  KeyOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useUserStore } from '../stores/user';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/market', icon: <ShopOutlined />, label: '需求广场' },
  { key: '/candidates', icon: <TeamOutlined />, label: '候选人管理' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI助手' },
  { key: '/notice-board', icon: <NotificationOutlined />, label: '通知公告' },
  { key: '/message-board', icon: <MessageOutlined />, label: '留言板' },
  { key: '/api-keys', icon: <KeyOutlined />, label: 'API Key' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

const breadcrumbMap: Record<string, string> = {
  '/': '仪表盘',
  '/projects': '项目管理',
  '/market': '需求广场',
  '/candidates': '候选人管理',
  '/ai': 'AI助手',
  '/notice-board': '通知公告',
  '/message-board': '留言板',
  '/api-keys': 'API Key 管理',
  '/settings': '系统设置',
  '/profile': '个人信息',
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser, token } = useUserStore();
  const { token: themeToken } = theme.useToken();

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
        </Header>
        <Content style={{ margin: 24, padding: 24, background: themeToken.colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
