import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { Duplex } from 'stream';
import joi from 'joi';
import { logger } from './utils/logger';
import { Chat } from './domain/entities/Chat';
import { Message } from './domain/entities/Message';
import { ConnectionRegistry } from './infrastructure/realtime/ConnectionRegistry';
import { getContactIds, setUserStatus } from './infrastructure/realtime/presence';
import { UserStatus } from './domain/entities/User';
import { AuthenticatedUser, getTokenFromCookieHeader, resolveUserFromToken } from './api/middlewares/auth';

export enum WebSocketMessageType {
    NEW_MESSAGE = 'NEW_MESSAGE',
    TYPING = 'TYPING',
    READ_RECEIPT = 'READ_RECEIPT',
    USER_STATUS = 'USER_STATUS',
    CHAT_CREATED = 'CHAT_CREATED',
    ERROR = 'ERROR'
}

export interface WebSocketMessage {
    type: WebSocketMessageType;
    payload: any;
}

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string; 
    username?: string; 
    isAlive?: boolean; 
}

const connections = new ConnectionRegistry();

const typingPayloadSchema = joi.object({
    chatId: joi.string().uuid().required(),
    isTyping: joi.boolean().required(),
});

const readReceiptPayloadSchema = joi.object({
    chatId: joi.string().uuid().required(),
    messageId: joi.string().uuid().required(),
});

class InvalidPayloadError extends Error {}

const validatePayload = <T>(schema: joi.ObjectSchema<T>, payload: unknown): T => {
    const { error, value } = schema.validate(payload);
    if (error) {
        throw new InvalidPayloadError(error.details[0].message);
    }
    return value;
};

const getParticipantsIfMember = async (chatId: string, userId: string): Promise<string[] | null> => {
    const chat = await Chat.findByPk(chatId, { attributes: ['participants'] });
    if (!chat || !chat.participants.includes(userId)) {
        return null;
    }
    return chat.participants;
};

const sendError = (ws: WebSocket, message: string) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: WebSocketMessageType.ERROR,
            payload: { message }
        }));
    }
};

const isSameOrigin = (req: http.IncomingMessage): boolean => {
    const { origin, host } = req.headers;
    if (!origin || !host) {
        return false;
    }
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
};

const rejectUpgrade = (socket: Duplex, statusCode: number, statusText: string) => {
    socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

const authenticateUpgrade = async (req: http.IncomingMessage): Promise<AuthenticatedUser | null> => {
    const token = getTokenFromCookieHeader(req.headers.cookie);
    if (!token) {
        return null;
    }
    return resolveUserFromToken(token);
};

export const initializeWebSocket = (server: http.Server) => {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
        if (!isSameOrigin(req)) {
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

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req, user);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws: AuthenticatedWebSocket) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000); 

    wss.on('close', () => {
        clearInterval(interval);
    });

    wss.on('connection', (ws: AuthenticatedWebSocket, req: http.IncomingMessage, userData: AuthenticatedUser) => {
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.userId = userData.id;
        ws.username = userData.username;
        if (connections.add(userData.id, ws)) {
            syncPresence(userData.id);
        }
        logger.info(`WebSocket client connected: ${userData.username} (ID: ${userData.id})`);

        ws.on('message', async (message: Buffer) => {
            let parsedMessage: WebSocketMessage;
            try {
                parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
            } catch {
                logger.warn(`Received malformed WebSocket message from ${ws.userId}`);
                sendError(ws, 'Invalid message format');
                return;
            }

            try {
                switch (parsedMessage.type) {
                    case WebSocketMessageType.TYPING:
                        await handleTypingIndicator(parsedMessage.payload, ws.userId!);
                        break;
                    case WebSocketMessageType.READ_RECEIPT:
                        await handleReadReceipt(parsedMessage.payload, ws.userId!);
                        break;
                    default:
                        logger.warn(`Unhandled message type: ${parsedMessage.type}`);
                }
            } catch (error) {
                if (error instanceof InvalidPayloadError) {
                    sendError(ws, error.message);
                    return;
                }
                logger.error(`Failed to handle ${parsedMessage.type} from ${ws.userId}`, { error });
                sendError(ws, 'Failed to process message');
            }
        });

        ws.on('close', (code, reason) => {
            const wasLastConnection = connections.remove(userData.id, ws);
            logger.info(`WebSocket client disconnected: ${userData.username} (ID: ${userData.id}), Code: ${code}, Reason: ${reason.toString()}`);

            if (wasLastConnection) {
                syncPresence(userData.id);
            }
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error for user ${userData.id}:`, { error });
        });
    });

    logger.info('WebSocket server initialized');
};

async function handleTypingIndicator(payload: unknown, senderId: string) {
    const { chatId, isTyping } = validatePayload(typingPayloadSchema, payload);

    const participants = await getParticipantsIfMember(chatId, senderId);
    if (!participants) {
        throw new InvalidPayloadError('You are not a participant in this chat');
    }

    broadcastMessageToUsers(participants, {
        type: WebSocketMessageType.TYPING,
        payload: {
            chatId,
            userId: senderId,
            isTyping
        }
    }, senderId);
}

async function handleReadReceipt(payload: unknown, readerId: string) {
    const { chatId, messageId } = validatePayload(readReceiptPayloadSchema, payload);

    const participants = await getParticipantsIfMember(chatId, readerId);
    if (!participants) {
        throw new InvalidPayloadError('You are not a participant in this chat');
    }

    const messageExists = await Message.count({ where: { id: messageId, chatId } });
    if (!messageExists) {
        throw new InvalidPayloadError('Message not found in this chat');
    }

    broadcastMessageToUsers(participants, {
        type: WebSocketMessageType.READ_RECEIPT,
        payload: {
            chatId,
            messageId,
            readerId,
            timestamp: new Date().toISOString()
        }
    });
}

const syncPresence = (userId: string): void => {
    const status: UserStatus = connections.isConnected(userId) ? 'online' : 'offline';
    publishUserStatus(userId, status).catch(error => {
        logger.error(`Failed to publish ${status} status for ${userId}`, { error });
    });
};

export const publishUserStatus = async (userId: string, status: UserStatus): Promise<void> => {
    await setUserStatus(userId, status);
    const contactIds = await getContactIds(userId);
    broadcastMessageToUsers(contactIds, {
        type: WebSocketMessageType.USER_STATUS,
        payload: {
            userId,
            status,
            timestamp: new Date().toISOString()
        }
    });
};

export const broadcastMessageToUsers = (userIds: string[], message: object, excludeUserId?: string) => {
    const payload = JSON.stringify(message);
    let sentCount = 0;
    new Set(userIds).forEach(userId => {
        if (userId !== excludeUserId) {
            sentCount += connections.sendToUser(userId, payload);
        }
    });
    logger.debug(`Broadcast ${(message as WebSocketMessage).type} to ${sentCount} connections`);
};
