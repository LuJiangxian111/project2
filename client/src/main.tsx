import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// 部署更新后，旧页面动态加载的JS分块可能已被删除（服务器返回HTML导致解析失败）
// 捕获该类错误并自动刷新一次以加载新版本（sessionStorage防刷新死循环）
const CHUNK_RELOAD_KEY = 'chunk_reload_flag';
window.addEventListener('error', (e) => {
  const msg = String(e?.message || '');
  if (
    (msg.includes('dynamically imported module') || msg.includes('Importing a module script failed')) &&
    !sessionStorage.getItem(CHUNK_RELOAD_KEY)
  ) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  }
});
// 刷新成功后清除标记（能执行到这里说明新版本加载正常）
sessionStorage.removeItem(CHUNK_RELOAD_KEY);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
