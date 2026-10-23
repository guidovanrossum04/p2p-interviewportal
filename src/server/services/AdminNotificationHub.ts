import { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

export interface AdminNotification {
  id: string;
  type: 'candidate_submission' | 'submission_updated' | 'assignment_updated';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  submissionId: string;
}

const adminSockets = new Set<WebSocket>();
const socketSessions = new Map<WebSocket, string>();
const recentNotifications: AdminNotification[] = [];
const MAX_RECENT_NOTIFICATIONS = 50;

export function attachAdminNotificationSocket(
  server: Server,
  getSessionExpiry: (token: string) => number | undefined,
): void {
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    } catch {
      socket.destroy();
      return;
    }
    if (requestUrl.pathname !== '/api/admin/notifications') return;

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      let isAuthenticated = false;
      const authenticationTimeout = setTimeout(() => client.close(4401, 'Authentication required'), 5000);
      let sessionTimeout: ReturnType<typeof setTimeout> | undefined;

      client.on('message', (message) => {
        if (isAuthenticated) return;
        let token: unknown;
        try {
          const payload = JSON.parse(message.toString()) as { type?: string; token?: unknown };
          if (payload.type === 'authenticate') token = payload.token;
        } catch {
          client.close(4401, 'Invalid authentication message');
          return;
        }
        if (typeof token !== 'string') {
          client.close(4401, 'Invalid admin session');
          return;
        }
        const expiresAt = getSessionExpiry(token);
        if (!expiresAt) {
          client.close(4401, 'Invalid admin session');
          return;
        }
        isAuthenticated = true;
        clearTimeout(authenticationTimeout);
        adminSockets.add(client);
        socketSessions.set(client, token);
        sessionTimeout = setTimeout(() => client.close(4401, 'Admin session expired'), expiresAt - Date.now());
        client.send(JSON.stringify({ type: 'authenticated' }));
        recentNotifications.forEach((notification) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'notification', notification, replay: true }));
          }
        });
      });

      client.on('close', () => {
        clearTimeout(authenticationTimeout);
        if (sessionTimeout) clearTimeout(sessionTimeout);
        adminSockets.delete(client);
        socketSessions.delete(client);
      });
      client.on('error', () => {
        clearTimeout(authenticationTimeout);
        if (sessionTimeout) clearTimeout(sessionTimeout);
        adminSockets.delete(client);
        socketSessions.delete(client);
      });
    });
  });
}

export function closeAdminSession(sessionToken: string): void {
  for (const [client, token] of socketSessions) {
    if (token === sessionToken) client.close(1000, 'Admin signed out');
  }
}

export function publishAdminNotification(notification: AdminNotification): void {
  recentNotifications.unshift(notification);
  recentNotifications.splice(MAX_RECENT_NOTIFICATIONS);
  const message = JSON.stringify({ type: 'notification', notification });
  for (const client of adminSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message, (error) => {
        if (error) {
          adminSockets.delete(client);
          socketSessions.delete(client);
          client.close();
        }
      });
    }
  }
}
