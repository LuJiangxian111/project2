import { io, Socket } from 'socket.io-client';
import { useUserStore } from './stores/user';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

export interface SocketEventMap {
  'project.created': (data: any) => void;
  'project.updated': (data: any) => void;
  'project.deleted': (data: { id: number }) => void;
  'position.created': (data: any) => void;
  'position.updated': (data: any) => void;
  'position.deleted': (data: { id: number }) => void;
  'position.batchUpdated': (data: { ids: number[]; data: any; success: number; failed: number }) => void;
  'candidate.created': (data: any) => void;
  'candidate.updated': (data: any) => void;
  'candidate.deleted': (data: { id: number; name: string }) => void;
  'candidate.added': (data: { positionId: number; candidateId: number; candidateName: string }) => void;
  'candidate.statusUpdated': (data: { cpId: number; status: string; candidateName: string }) => void;
  'candidate.matched': (data: { candidateId: number; positionId: number; score: number }) => void;
}

const eventListeners = new Map<keyof SocketEventMap, Set<(data: any) => void>>();

function getSocketUrl() {
  // 生产环境使用当前域名，开发环境使用 localhost
  if (window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function initSocket() {
  if (socket) {
    return;
  }

  const userId = useUserStore.getState().user?.id;
  const socketUrl = getSocketUrl();
  socket = io(socketUrl, {
    path: '/api/socket.io',
    query: userId ? { userId } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
    if (reason === 'io server disconnect') {
      socket?.connect();
    }
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    reconnectAttempts++;
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached');
    }
  });

  const events: (keyof SocketEventMap)[] = [
    'project.created', 'project.updated', 'project.deleted',
    'position.created', 'position.updated', 'position.deleted', 'position.batchUpdated',
    'candidate.created', 'candidate.updated', 'candidate.deleted',
    'candidate.added', 'candidate.statusUpdated', 'candidate.matched',
  ];

  events.forEach((event) => {
    socket?.on(event, (data) => {
      eventListeners.get(event)?.forEach((listener) => listener(data));
    });
  });
}

export function on<T extends keyof SocketEventMap>(event: T, callback: SocketEventMap[T]) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

export function off<T extends keyof SocketEventMap>(event: T, callback: SocketEventMap[T]) {
  eventListeners.get(event)?.delete(callback);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  eventListeners.clear();
}

export function getSocket(): Socket | null {
  return socket;
}