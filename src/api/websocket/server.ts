import http from 'http';
import { Duplex } from 'stream';
import joi from 'joi';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../../config';
import { connectionRegistry, messageService, presenceService } from '../../container';
import { AppError } from '../../core/errors';
import { RealtimeEventType } from '../../core/realtime';
import { logger } from '../../utils/logger';
import { AuthenticatedUser, getTokenFromCookieHeader, resolveUserFromToken } from '../middlewares/auth';

const HEARTBEAT_INTERVAL_MS = 30000;
export const WEBSOCKET_PATH = '/ws';

interface ClientMessage {
  type: string;
  payload: unknown;
}

interface TrackedWebSocket extends WebSocket {
  isAlive: boolean;
}

const clientMessageSchema = joi.object({
  type: joi.string().required(),
  payload: joi.any(),
});

const typingPayloadSchema = joi.object({
  chatId: joi.string().uuid().required(),
  isTyping: joi.boolean().required(),
});

const readReceiptPayloadSchema = joi.object({
  chatId: joi.string().uuid().required(),
  messageId: joi.string().uuid().required(),
});

class InvalidPayloadError extends Error {}

const validate = <T>(schema: joi.Schema<T>, value: unknown): T => {
  const { error, value: validated } = schema.validate(value);
  if (error) {
    throw new InvalidPayloadError(error.details[0].message);
  }
  return validated;
};

const sendError = (ws: WebSocket, message: string): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: RealtimeEventType.ERROR, payload: { message } }));
  }
};

const isAllowedOrigin = (req: http.IncomingMessage): boolean => {
  const { origin, host } = req.headers;
  if (!origin) {
    return false;
  }
  if (config.corsOrigins.includes(origin)) {
    return true;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const rejectUpgrade = (socket: Duplex, statusCode: number, statusText: string): void => {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

const authenticateUpgrade = async (req: http.IncomingMessage): Promise<AuthenticatedUser | null> => {
  const token = getTokenFromCookieHeader(req.headers.cookie);
  return token ? resolveUserFromToken(token) : null;
};

const syncPresence = (userId: string): void => {
  presenceService.syncWithConnections(userId).catch((error) => {
    logger.error(`Failed to update presence for ${userId}`, { error });
  });
};

const dispatch = async (message: ClientMessage, user: AuthenticatedUser): Promise<void> => {
  switch (message.type) {
    case RealtimeEventType.TYPING: {
      const { chatId, isTyping } = validate(typingPayloadSchema, message.payload);
      await messageService.publishTyping(chatId, user.id, isTyping);
      break;
    }
    case RealtimeEventType.READ_RECEIPT: {
      const { chatId, messageId } = validate(readReceiptPayloadSchema, message.payload);
      await messageService.markAsRead(messageId, user.id, chatId);
      break;
    }
    default:
      throw new InvalidPayloadError(`Unsupported message type: ${message.type}`);
  }
};

const handleMessage = async (ws: WebSocket, data: Buffer, user: AuthenticatedUser): Promise<void> => {
  let message: ClientMessage;
  try {
    message = validate(clientMessageSchema, JSON.parse(data.toString()));
  } catch {
    sendError(ws, 'Invalid message format');
    return;
  }

  try {
    await dispatch(message, user);
  } catch (error) {
    if (error instanceof InvalidPayloadError || error instanceof AppError) {
      sendError(ws, error.message);
      return;
    }
    logger.error(`Failed to handle ${message.type} from ${user.id}`, { error });
    sendError(ws, 'Failed to process message');
  }
};

const handleConnection = (ws: TrackedWebSocket, user: AuthenticatedUser): void => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  if (connectionRegistry.add(user.id, ws)) {
    syncPresence(user.id);
  }
  logger.info(`WebSocket client connected: ${user.username} (ID: ${user.id})`);

  ws.on('message', (data: Buffer) => {
    void handleMessage(ws, data, user);
  });

  ws.on('close', (code, reason) => {
    if (connectionRegistry.remove(user.id, ws)) {
      syncPresence(user.id);
    }
    logger.info(
      `WebSocket client disconnected: ${user.username} (ID: ${user.id}), Code: ${code}, Reason: ${reason.toString()}`,
    );
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error for user ${user.id}`, { error });
  });
};

export const initializeWebSocket = (server: http.Server): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== WEBSOCKET_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    if (!isAllowedOrigin(req)) {
      logger.warn('WebSocket upgrade rejected: origin mismatch', { origin: req.headers.origin });
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    let user: AuthenticatedUser | null;
    try {
      user = await authenticateUpgrade(req);
    } catch (error) {
      logger.error('WebSocket upgrade failed during authentication', { error });
      rejectUpgrade(socket, 500, 'Internal Server Error');
      return;
    }

    if (!user) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws as TrackedWebSocket, user));
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as TrackedWebSocket;
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server initialized');
  return wss;
};
