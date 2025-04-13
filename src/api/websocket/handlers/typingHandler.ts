import { broadcastToUsers } from '..';
import { Chat } from '../../../domain/entities/Chat';
import { User } from '../../../domain/entities/User';
import { logger } from '../../../utils/logger';

// Store typing status with expiration
const typingUsers = new Map<string, NodeJS.Timeout>();
const TYPING_TIMEOUT = 5000; // 5 seconds

export const handleTypingStatus = async (userId: string, chatId: string, isTyping: boolean): Promise<void> => {
  try {
    // Find the chat and check if user is a participant
    const chat = await Chat.findByPk(chatId);
    
    if (!chat) {
      logger.warn('Chat not found for typing status', { chatId });
      return;
    }

    if (!chat.participants.includes(userId)) {
      logger.warn('User is not a participant in this chat', { userId, chatId });
      return;
    }

    // Get user information
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'displayName'],
    });

    if (!user) {
      logger.warn('User not found for typing status', { userId });
      return;
    }

    // Generate a unique key for this user+chat
    const typingKey = `${userId}-${chatId}`;

    // Clear existing timeout if any
    if (typingUsers.has(typingKey)) {
      clearTimeout(typingUsers.get(typingKey));
      typingUsers.delete(typingKey);
    }

    // If user is typing, set timeout to automatically clear status
    if (isTyping) {
      const timeout = setTimeout(() => {
        // Automatically set typing to false after timeout
        typingUsers.delete(typingKey);
        
        // Broadcast typing stopped to all participants
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

    // Broadcast to all participants except the sender
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