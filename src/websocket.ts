import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { Duplex } from 'stream';
import { logger } from './utils/logger';
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

const clients = new Map<string, AuthenticatedWebSocket>();

const userStatuses = new Map<string, 'online' | 'away' | 'offline'>();

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
                if (ws.userId) {
                    clients.delete(ws.userId);
                    updateUserStatus(ws.userId, 'offline');
                }
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
        clients.set(userData.id, ws);
        updateUserStatus(userData.id, 'online');
        logger.info(`WebSocket client connected: ${userData.username} (ID: ${userData.id})`);

        ws.on('message', (message: Buffer) => {
            try {
                const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
                logger.info(`Received message from ${ws.userId}:`, { type: parsedMessage.type });
                
                switch (parsedMessage.type) {
                    case WebSocketMessageType.TYPING:
                        handleTypingIndicator(parsedMessage.payload, ws.userId!);
                        break;
                    case WebSocketMessageType.READ_RECEIPT:
                        handleReadReceipt(parsedMessage.payload, ws.userId!);
                        break;
                    default:
                        logger.warn(`Unhandled message type: ${parsedMessage.type}`);
                }
            } catch (e) {
                logger.error(`Failed to parse message from ${ws.userId} or invalid message format`, { message: message.toString(), error: e });
                
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: WebSocketMessageType.ERROR,
                        payload: { message: 'Invalid message format' }
                    }));
                }
            }
        });

        ws.on('close', (code, reason) => {
            if (ws.userId) {
                clients.delete(ws.userId);
                updateUserStatus(ws.userId, 'offline');
                logger.info(`WebSocket client disconnected: ${ws.username} (ID: ${ws.userId}), Code: ${code}, Reason: ${reason.toString()}`);
                
                broadcastUserStatus(ws.userId, 'offline');
            }
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket error for user ${ws.userId || 'unknown'}:`, { error });
            if (ws.userId) {
                clients.delete(ws.userId);
                updateUserStatus(ws.userId, 'offline');
            }
        });
    });

    logger.info('WebSocket server initialized');
};

function handleTypingIndicator(payload: { 
    chatId: string; 
    isTyping: boolean; 
    participantIds: string[] 
}, senderId: string) {
    const { chatId, isTyping, participantIds } = payload;
    
    if (participantIds && Array.isArray(participantIds)) {
        const message = {
            type: WebSocketMessageType.TYPING,
            payload: {
                chatId,
                userId: senderId,
                isTyping
            }
        };
        
        broadcastMessageToUsers(participantIds, message, senderId);
    }
}

function handleReadReceipt(payload: { 
    chatId: string; 
    messageId: string; 
    participantIds: string[] 
}, readerId: string) {
    const { chatId, messageId, participantIds } = payload;
    
    if (participantIds && Array.isArray(participantIds)) {
        const message = {
            type: WebSocketMessageType.READ_RECEIPT,
            payload: {
                chatId,
                messageId,
                readerId,
                timestamp: new Date().toISOString()
            }
        };
        
        broadcastMessageToUsers(participantIds, message);
    }
}

function updateUserStatus(userId: string, status: 'online' | 'away' | 'offline') {
    userStatuses.set(userId, status);
}

function broadcastUserStatus(userId: string, status: 'online' | 'away' | 'offline') {

    const message = {
        type: WebSocketMessageType.USER_STATUS,
        payload: {
            userId,
            status,
            timestamp: new Date().toISOString()
        }
    };
    
    const allUserIds = Array.from(clients.keys());
    broadcastMessageToUsers(allUserIds, message, userId);
}

export const sendNewMessageNotification = (messageData: any) => {
    const { chatId, participantIds, excludeSenderId } = messageData;
    
    if (!participantIds || !Array.isArray(participantIds)) {
        logger.warn('Cannot send message notification: participantIds missing or invalid');
        return;
    }
    
    const message = {
        type: WebSocketMessageType.NEW_MESSAGE,
        payload: messageData
    };
    
    broadcastMessageToUsers(participantIds, message, excludeSenderId);
};

export const sendMessageToUser = (userId: string, message: object) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        logger.info(`Sent message to user ${userId}`, { message });
        return true;
    } else {
        logger.warn(`Attempted to send message to disconnected or non-existent user ${userId}`);
        return false;
    }
};

export const broadcastMessageToUsers = (userIds: string[], message: object, excludeSenderId?: string) => {
    let sentCount = 0;
    userIds.forEach(userId => {
        if (userId === excludeSenderId) return; 
        const client = clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            sentCount++;
        }
    });
    if (userIds.length > (excludeSenderId ? 1 : 0)) { 
        logger.info(`Broadcast message to ${sentCount}/${userIds.length - (excludeSenderId ? 1 : 0)} connected users`);
    }
}; 

export const getUserStatus = (userId: string): 'online' | 'away' | 'offline' => {
    return userStatuses.get(userId) || 'offline';
};

export const isUserConnected = (userId: string): boolean => {
    const client = clients.get(userId);
    return !!(client && client.readyState === WebSocket.OPEN);
}; 