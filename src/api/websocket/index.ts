import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../middlewares/auth';
import { logger } from '../../utils/logger';
import { handleChatMessage } from './handlers/messageHandler';
import { handleUserStatus } from './handlers/statusHandler';
import { handleTypingStatus } from './handlers/typingHandler';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string;
}

interface WebSocketMessage {
  type: string;
  payload: any;
}

// Store active connections
const clients = new Map<string, ExtendedWebSocket>();

export const setupWebsocketHandlers = (wss: WebSocketServer): void => {
  wss.on('connection', async (ws: WebSocket, request) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;

    // Get token from query string
    const url = new URL(request.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      extWs.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify and decode JWT token
      const decoded = await verifyToken(token);
      extWs.userId = decoded.userId;

      // Store the connection
      clients.set(decoded.userId, extWs);
      logger.info(`WebSocket client connected: ${decoded.userId}`);

      // Send welcome message
      extWs.send(JSON.stringify({
        type: 'connection_established',
        payload: { userId: decoded.userId, message: 'Connected to chat server' },
      }));

      // Update user status to online
      handleUserStatus(decoded.userId, 'online');

      // Ping/Pong to keep connection alive
      extWs.on('pong', () => {
        extWs.isAlive = true;
      });

      // Handle WebSocket messages
      extWs.on('message', async (data: string) => {
        try {
          const message: WebSocketMessage = JSON.parse(data);
          
          switch (message.type) {
            case 'chat_message':
              await handleChatMessage(extWs.userId, message.payload);
              break;
            case 'status_update':
              await handleUserStatus(extWs.userId, message.payload.status);
              break;
            case 'typing_status':
              await handleTypingStatus(extWs.userId, message.payload.chatId, message.payload.isTyping);
              break;
            default:
              logger.warn(`Unknown message type: ${message.type}`);
          }
        } catch (error: any) {
          logger.error('Error processing WebSocket message', { error, userId: extWs.userId });
          extWs.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Invalid message format' },
          }));
        }
      });

      // Handle disconnection
      extWs.on('close', async () => {
        clients.delete(extWs.userId);
        logger.info(`WebSocket client disconnected: ${extWs.userId}`);
        
        // Update user status to offline
        await handleUserStatus(extWs.userId, 'offline');
      });
    } catch (error: any) {
      logger.error('WebSocket authentication error', { error });
      extWs.close(1008, 'Authentication failed');
    }
  });

  // Set up interval to ping clients and clean up dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      
      if (extWs.isAlive === false) {
        clients.delete(extWs.userId);
        return extWs.terminate();
      }
      
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
};

// Utility function to broadcast to specific users
export const broadcastToUsers = (userIds: string[], message: any): void => {
  userIds.forEach(userId => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// Utility function to broadcast to all clients
export const broadcastToAll = (message: any): void => {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}; 