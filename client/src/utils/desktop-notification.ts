/**
 * 消息提醒工具
 * 1. 系统桌面通知：基于 Web Notification API（需要 HTTPS 安全上下文 + 用户授权）
 * 2. 页面内弹窗兜底：右下角浮动通知卡片（无需任何权限，HTTP 环境可用）
 * 3. 标签页标题闪烁：浏览器最小化/后台时在任务栏显著提醒
 */
import { notification } from 'antd';

const DESKTOP_ENABLED_KEY = 'desktop_notification_enabled';

/** 通知开关是否开启（默认开启） */
export function isDesktopNotifyEnabled(): boolean {
  return localStorage.getItem(DESKTOP_ENABLED_KEY) !== 'false';
}

/** 设置通知开关 */
export function setDesktopNotifyEnabled(enabled: boolean) {
  localStorage.setItem(DESKTOP_ENABLED_KEY, String(enabled));
}

/** 浏览器是否支持系统通知 API */
export function isDesktopNotifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 是否为安全上下文（HTTPS/localhost）——系统通知的前提 */
export function isSecureContextAvailable(): boolean {
  return typeof window !== 'undefined' && (window.isSecureContext || window.location.protocol === 'https:');
}

/** 系统通知是否真正可用（支持 API + 安全上下文 + 已授权） */
export function isSystemNotificationUsable(): boolean {
  return isDesktopNotifySupported() && isSecureContextAvailable() && Notification.permission === 'granted';
}

/** 当前通知权限状态 */
export function getDesktopPermission(): NotificationPermission | 'unsupported' {
  if (!isDesktopNotifySupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * 请求系统通知权限（需在用户交互中调用，且仅在安全上下文有意义）
 */
export async function requestDesktopPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isDesktopNotifySupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// ==================== 标签页标题闪烁 ====================
let flashTimer: number | null = null;
let originalTitle: string | null = null;

/** 开始闪烁标签页标题（如"【新消息】AI岗位需求广场"），窗口获得焦点后自动停止 */
export function startTitleFlash(prefix: string) {
  if (typeof document === 'undefined') return;
  if (flashTimer !== null) return; // 已在闪烁
  originalTitle = document.title;
  let toggle = false;
  flashTimer = window.setInterval(() => {
    toggle = !toggle;
    document.title = toggle ? `【${prefix}】${originalTitle}` : (originalTitle || '');
  }, 700);
  const onFocus = () => stopTitleFlash();
  window.addEventListener('focus', onFocus);
}

/** 停止标题闪烁，恢复原标题 */
export function stopTitleFlash() {
  if (flashTimer !== null) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (originalTitle !== null) {
    document.title = originalTitle;
    originalTitle = null;
  }
}

// ==================== 统一提醒入口 ====================

/**
 * 页面内浮动弹窗（右下角，模拟桌面弹窗位置）
 */
function showInPageNotification(title: string, body: string, onClick?: () => void) {
  notification.open({
    message: title,
    description: body || '点击查看详情',
    placement: 'bottomRight',
    duration: 8,
    onClick: () => {
      onClick?.();
    },
  });
}

/**
 * 统一消息提醒：
 * - 安全上下文且已授权 → 系统桌面弹窗
 * - 否则 → 页面内右下角弹窗
 * - 浏览器窗口不在前台时 → 标签页标题闪烁
 * @param title 通知标题
 * @param body 通知内容
 * @param onClick 点击回调（如跳转页面）
 * @param flashPrefix 标题闪烁前缀（默认"新消息"）
 */
export function notifyMessage(
  title: string,
  body: string,
  onClick?: () => void,
  flashPrefix: string = '新消息',
) {
  if (!isDesktopNotifyEnabled()) return;

  // 窗口不在前台时闪烁标题
  if (typeof document !== 'undefined' && document.hidden) {
    startTitleFlash(flashPrefix);
  }

  if (isSystemNotificationUsable()) {
    // 系统级桌面弹窗
    try {
      const sysNotification = new Notification(title, {
        body: body || '',
        icon: '/logo.jpg',
        tag: `ai-position-${Date.now()}`,
      });
      if (onClick) {
        sysNotification.onclick = () => {
          window.focus();
          onClick();
          sysNotification.close();
        };
      }
      setTimeout(() => sysNotification.close(), 8000);
      return;
    } catch {
      // 落入页面内弹窗
    }
  }

  // 页面内弹窗兜底（HTTP 环境或未授权时）
  showInPageNotification(title, body, onClick);
}
