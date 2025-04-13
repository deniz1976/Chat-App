import { broadcastToUsers } from '..';
import { Chat } from '../../../domain/entities/Chat';
import { Message, MessageType } from '../../../domain/entities/Message';
import { User } from '../../../domain/entities/User';
import { logger } from '../../../utils/logger';

interface MessagePayload {
  chatId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  replyToId?: string;
}

export const handleChatMessage = async (senderId: string, payload: MessagePayload): Promise<void> => {
  try {
    // Validate payload
    if (!payload.chatId || !payload.content) {
      logger.warn('Invalid message payload', { senderId, payload });
      return;
    }

    // Find the chat and check if user is a participant
    const chat = await Chat.findByPk(payload.chatId);
    
    if (!chat) {
      logger.warn('Chat not found', { chatId: payload.chatId });
      return;
    }

    if (!chat.participants.includes(senderId)) {
      logger.warn('User is not a participant in this chat', { senderId, chatId: payload.chatId });
      return;
    }

    // Create message in database
    const message = await Message.create({
      senderId,
      chatId: payload.chatId,
      content: payload.content,
      type: payload.type || MessageType.TEXT,
      mediaUrl: payload.mediaUrl,
      replyToId: payload.replyToId,
      readBy: [senderId], // Mark as read by sender
    });

    // Update chat's last message
    await chat.update({ lastMessageId: message.id });

    // Get sender information
    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'username', 'displayName', 'profileImage'],
    });

    // Get reply message if it exists
    let replyMessage = null;
    if (payload.replyToId) {
      replyMessage = await Message.findByPk(payload.replyToId, {
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'displayName', 'profileImage'],
        }],
      });
    }

    // Create response object
    const messageResponse = {
      ...message.toJSON(),
      sender,
      replyTo: replyMessage,
    };

    // Broadcast to all participants in the chat except sender
    const recipients = chat.participants.filter(id => id !== senderId);
    
    broadcastToUsers(recipients, {
      type: 'new_message',
      payload: messageResponse,
    });

    logger.info('Message sent', { messageId: message.id, chatId: payload.chatId, senderId });
  } catch (error: any) {
    logger.error('Error handling chat message', { error, senderId, payload });
  }
}; 