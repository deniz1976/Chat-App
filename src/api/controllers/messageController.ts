import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { Message, MessageType } from '../../domain/entities/Message';
import { Chat } from '../../domain/entities/Chat';
import { User } from '../../domain/entities/User';
import { Op } from 'sequelize';
import { broadcastMessageToUsers } from '../../websocket';

const messageRepository = {
    findByChatId: async (chatId: string, limit: number, offset: number) => {
        return Message.findAll({
            where: { chatId },
            limit,
            offset,
            order: [['createdAt', 'ASC']],
            include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }]
        });
    },
    findById: async (id: string) => {
        return Message.findByPk(id, {
             include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }]
        });
    },
    create: async (data: any) => {
        return Message.create(data);
    },
    update: async (id: string, senderId: string, data: any) => {
        const message = await Message.findOne({ where: { id, senderId }});
        if (!message) return null;
        return message.update(data);
    },
    delete: async (id: string, senderId: string) => {
        const message = await Message.findOne({ where: { id, senderId } });
        if (!message) return false;
        await message.destroy();
        return true;
    },
    markAsRead: async (messageId: string, userId: string) => {
        const message = await Message.findByPk(messageId);
        if (!message) return false;
        if (message.readBy.includes(userId)) return true;

        const updatedReadBy = [...message.readBy, userId];
        await message.update({ readBy: updatedReadBy });
        return true;
    },
    getUnreadCount: async (chatId: string, userId: string) => {
       return Message.count({
           where: {
               chatId,
               senderId: { [Op.ne]: userId },
               readBy: { [Op.not]: { [Op.contains]: [userId] } }
           }
       });
    },
    findMediaByChatId: async (chatId: string, limit: number, offset: number) => {
        return Message.findAll({
            where: {
                chatId,
                type: { [Op.in]: [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE] }
            },
            limit,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }]
        });
    },
    search: async (chatId: string, query: string, limit: number, offset: number) => {
        return Message.findAll({
            where: {
                chatId,
                content: { [Op.iLike]: `%${query}%` }
            },
            limit,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }]
        });
    }
};

const checkChatParticipation = async (chatId: string, userId: string): Promise<boolean> => {
    const chat = await Chat.findByPk(chatId, { attributes: ['participants'] });
    return chat?.participants.includes(userId) ?? false;
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
        const isParticipant = await checkChatParticipation(chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You are not a participant in this chat' });
            return;
        }
        const messages = await messageRepository.findByChatId(chatId, limit, offset);
        res.status(200).json(messages);
        logger.info(`Retrieved messages for chat ${chatId}`);
    } catch (error: any) {
        logger.error(`Error getting messages for chat ${chatId}`, { error, userId });
        res.status(500).json({ message: 'Failed to retrieve messages' });
    }
};

export const getMessage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
        const message = await messageRepository.findById(id);
        if (!message) {
            res.status(404).json({ message: 'Message not found' });
            return;
        }
        const isParticipant = await checkChatParticipation(message.chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You are not authorized to view this message' });
            return;
        }

        res.status(200).json(message);
        logger.info(`Retrieved message ${id}`);
    } catch (error: any) {
        logger.error(`Error getting message ${id}`, { error, userId });
        res.status(500).json({ message: 'Failed to retrieve message' });
    }
};

export const createMessage = async (req: Request, res: Response): Promise<void> => {
    const { chatId, content, type, mediaUrl, replyToId } = req.body;
    const senderId = req.user!.id;

    try {
         const chat = await Chat.findByPk(chatId, { attributes: ['participants']});
         if (!chat) {
             res.status(404).json({ message: 'Chat not found' });
             return;
         }
         if (!chat.participants.includes(senderId)) {
             res.status(403).json({ message: 'You cannot send messages to a chat you are not part of' });
             return;
         }

        const messageData = {
            senderId,
            chatId,
            content,
            type: type || MessageType.TEXT,
            mediaUrl,
            replyToId,
            readBy: [senderId]
        };
        const message = await Message.create(messageData);

        const messageWithSender = await Message.findByPk(message.id, {
             include: [{ model: User, as: 'sender', attributes: ['id', 'username', 'displayName', 'profileImage'] }]
        });

        await Chat.update({ lastMessageId: message.id }, { where: { id: chatId }});

        if (messageWithSender) {
            const broadcastPayload = {
                type: 'NEW_MESSAGE',
                payload: messageWithSender
            };
            broadcastMessageToUsers(chat.participants, broadcastPayload, senderId);
        }

        res.status(201).json(messageWithSender || message);
        logger.info(`Created and broadcasted message in chat ${chatId} by user ${senderId}`);
    } catch (error: any) {
        logger.error(`Error creating message in chat ${chatId}`, { error, senderId });
        res.status(500).json({ message: 'Failed to create message' });
    }
};

export const updateMessage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { content } = req.body;
    const senderId = req.user!.id;

    if (!content) {
         res.status(400).json({ message: 'Message content is required for update' });
         return;
    }

    try {
        const updatedMessage = await messageRepository.update(id, senderId, { content });
        if (!updatedMessage) {
            res.status(404).json({ message: 'Message not found or you are not the sender' });
            return;
        }
        res.status(200).json(updatedMessage);
        logger.info(`Updated message ${id} by user ${senderId}`);
    } catch (error: any) {
        logger.error(`Error updating message ${id}`, { error, senderId });
        res.status(500).json({ message: 'Failed to update message' });
    }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const senderId = req.user!.id;

    try {
        const deleted = await messageRepository.delete(id, senderId);
        if (!deleted) {
            res.status(404).json({ message: 'Message not found or you are not the sender' });
            return;
        }
        res.status(204).send();
        logger.info(`Deleted message ${id} by user ${senderId}`);
    } catch (error: any) {
        logger.error(`Error deleting message ${id}`, { error, senderId });
        res.status(500).json({ message: 'Failed to delete message' });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
        const messageInfo = await Message.findByPk(id, { attributes: ['chatId'] });
        if (!messageInfo) {
             res.status(404).json({ message: 'Message not found' });
             return;
        }
        const isParticipant = await checkChatParticipation(messageInfo.chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You cannot mark messages in this chat as read' });
            return;
        }

        const success = await messageRepository.markAsRead(id, userId);
        if (!success) {
            res.status(404).json({ message: 'Message not found' });
            return;
        }
        res.status(200).json({ message: 'Message marked as read' });
        logger.info(`Marked message ${id} as read for user ${userId}`);
    } catch (error: any) {
        logger.error(`Error marking message ${id} as read`, { error, userId });
        res.status(500).json({ message: 'Failed to mark message as read' });
    }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    const userId = req.user!.id;

    try {
        const isParticipant = await checkChatParticipation(chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You are not a participant in this chat' });
            return;
        }
        const count = await messageRepository.getUnreadCount(chatId, userId);
        res.status(200).json({ unreadCount: count });
        logger.info(`Retrieved unread count for chat ${chatId}, user ${userId}`);
    } catch (error: any) {
        logger.error(`Error getting unread count for chat ${chatId}`, { error, userId });
        res.status(500).json({ message: 'Failed to get unread count' });
    }
};

export const getMediaMessages = async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
        const isParticipant = await checkChatParticipation(chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You are not a participant in this chat' });
            return;
        }
        const messages = await messageRepository.findMediaByChatId(chatId, limit, offset);
        res.status(200).json(messages);
        logger.info(`Retrieved media messages for chat ${chatId}`);
    } catch (error: any) {
        logger.error(`Error getting media messages for chat ${chatId}`, { error, userId });
        res.status(500).json({ message: 'Failed to retrieve media messages' });
    }
};

export const searchMessages = async (req: Request, res: Response): Promise<void> => {
    const { chatId } = req.params;
    const query = req.query.q as string;
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query) {
        res.status(400).json({ message: 'Search query parameter "q" is required' });
        return;
    }

    try {
        const isParticipant = await checkChatParticipation(chatId, userId);
        if (!isParticipant) {
            res.status(403).json({ message: 'You are not authorized to search in this chat' });
            return;
        }
        const messages = await messageRepository.search(chatId, query, limit, offset);
        res.status(200).json(messages);
        logger.info(`Searched messages in chat ${chatId} with query: ${query}`);
    } catch (error: any) {
        logger.error(`Error searching messages in chat ${chatId}`, { error, userId, query });
        res.status(500).json({ message: 'Failed to search messages' });
    }
};
