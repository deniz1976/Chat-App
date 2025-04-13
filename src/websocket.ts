import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import url from 'url';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { logger } from './utils/logger';

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

const verifyClient = (token: string): { userId: string; username: string; email: string } | null => {
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
        return {
            userId: decoded.userId,
            username: decoded.username,
            email: decoded.email
        };
    } catch (err) {
        logger.warn('WebSocket connection failed: Invalid token', { token });
        return null;
    }
};

export const initializeWebSocket = (server: http.Server) => {
    const wss = new WebSocketServer({ server });

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

    wss.on('connection', (ws: AuthenticatedWebSocket, req: http.IncomingMessage) => {
        const parameters = url.parse(req.url || '', true).query;
        const token = parameters.token as string;

        const userData = verifyClient(token);

        if (!userData) {
            logger.info('WebSocket connection rejected: No valid token provided');
            ws.close(1008, 'Invalid or missing token'); 
            return;
        }

        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.userId = userData.userId;
        ws.username = userData.username;
        clients.set(userData.userId, ws);
        updateUserStatus(userData.userId, 'online');
        logger.info(`WebSocket client connected: ${userData.username} (ID: ${userData.userId})`);

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