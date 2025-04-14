import { broadcastToUsers } from '..';
import { Chat } from '../../../domain/entities/Chat';
import { User } from '../../../domain/entities/User';
import { logger } from '../../../utils/logger';

const typingUsers = new Map<string, NodeJS.Timeout>();
const TYPING_TIMEOUT = 5000;

export const handleTypingStatus = async (userId: string, chatId: string, isTyping: boolean): Promise<void> => {
  try {
    const chat = await Chat.findByPk(chatId);
    
    if (!chat) {
      logger.warn('Chat not found for typing status', { chatId });
      return;
    }

    if (!chat.participants.includes(userId)) {
      logger.warn('User is not a participant in this chat', { userId, chatId });
      return;
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'displayName'],
    });

    if (!user) {
      logger.warn('User not found for typing status', { userId });
      return;
    }

    const typingKey = `${userId}-${chatId}`;

    if (typingUsers.has(typingKey)) {
      clearTimeout(typingUsers.get(typingKey));
      typingUsers.delete(typingKey);
    }

    if (isTyping) {
      const timeout = setTimeout(() => {
        typingUsers.delete(typingKey);
        
        const recipients = chat.participants.filter(id => id !== userId);
        broadcastToUsers(recipients, {
          type: 'user_typing',
          payload: {
            chatId,
            userId,
            username: user.username,
            displayName: user.displayName,
            isTyping: false,
          },
        });
      }, TYPING_TIMEOUT);

      typingUsers.set(typingKey, timeout);
    }

    const recipients = chat.participants.filter(id => id !== userId);
    
    broadcastToUsers(recipients, {
      type: 'user_typing',
      payload: {
        chatId,
        userId,
        username: user.username,
        displayName: user.displayName,
        isTyping,
      },
    });

    logger.debug('User typing status updated', { 
      userId, 
      chatId, 
      isTyping,
      activeTypers: Array.from(typingUsers.keys()).filter(key => key.endsWith(`-${chatId}`)).length
    });
  } catch (error: any) {
    logger.error('Error handling typing status', { error, userId, chatId, isTyping });
  }
}; 