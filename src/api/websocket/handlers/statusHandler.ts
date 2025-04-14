import { broadcastToAll } from '..';
import { User } from '../../../domain/entities/User';
import { UserRepositoryImpl } from '../../../infrastructure/repositories/UserRepositoryImpl';
import { logger } from '../../../utils/logger';

const userRepository = new UserRepositoryImpl();

export const handleUserStatus = async (userId: string, status: 'online' | 'offline' | 'away'): Promise<void> => {
  try {
    const user = await userRepository.updateStatus(userId, status);
    
    if (!user) {
      logger.warn('User not found for status update', { userId, status });
      return;
    }

    if (status === 'offline') {
      await userRepository.updateLastSeen(userId, new Date());
    }

    broadcastToAll({
      type: 'user_status_changed',
      payload: {
        userId,
        status,
        lastSeen: user.lastSeen,
      },
    });

    logger.info('User status updated', { userId, status });
  } catch (error: any) {
    logger.error('Error handling user status update', { error, userId, status });
  }
}; 