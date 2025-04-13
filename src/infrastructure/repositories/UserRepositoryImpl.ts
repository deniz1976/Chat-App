import { Op } from 'sequelize';
import { User, UserCreationAttributes } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { logger } from '../../utils/logger';

export class UserRepositoryImpl implements UserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      return await User.findByPk(id);
    } catch (error: any) {
      logger.error('Error finding user by id', { error, id });
      throw new Error(`Failed to find user by id: ${error.message}`);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await User.findOne({ where: { email } });
    } catch (error: any) {
      logger.error('Error finding user by email', { error, email });
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      return await User.findOne({ where: { username } });
    } catch (error: any) {
      logger.error('Error finding user by username', { error, username });
      throw new Error(`Failed to find user by username: ${error.message}`);
    }
  }

  async create(userData: UserCreationAttributes): Promise<User> {
    try {
      return await User.create(userData);
    } catch (error: any) {
      logger.error('Error creating user', { error, userData });
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async update(id: string, userData: Partial<UserCreationAttributes>): Promise<User | null> {
    try {
      const user = await User.findByPk(id);
      
      if (!user) {
        return null;
      }

      return await user.update(userData);
    } catch (error: any) {
      logger.error('Error updating user', { error, id, userData });
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const rowsDeleted = await User.destroy({ where: { id } });
      return rowsDeleted > 0;
    } catch (error: any) {
      logger.error('Error deleting user', { error, id });
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async updateStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<User | null> {
    try {
      const user = await User.findByPk(id);
      
      if (!user) {
        return null;
      }

      return await user.update({ status });
    } catch (error: any) {
      logger.error('Error updating user status', { error, id, status });
      throw new Error(`Failed to update user status: ${error.message}`);
    }
  }

  async updateLastSeen(id: string, lastSeen: Date): Promise<User | null> {
    try {
      const user = await User.findByPk(id);
      
      if (!user) {
        return null;
      }

      return await user.update({ lastSeen });
    } catch (error: any) {
      logger.error('Error updating user last seen', { error, id });
      throw new Error(`Failed to update user last seen: ${error.message}`);
    }
  }

  async search(query: string, limit = 20, offset = 0): Promise<User[]> {
    try {
      return await User.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.iLike]: `%${query}%` } },
            { displayName: { [Op.iLike]: `%${query}%` } },
            { email: { [Op.iLike]: `%${query}%` } },
          ],
        },
        limit,
        offset,
      });
    } catch (error: any) {
      logger.error('Error searching users', { error, query });
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }

  async getAll(limit = 100, offset = 0): Promise<User[]> {
    try {
      return await User.findAll({
        limit,
        offset,
        order: [['username', 'ASC']],
      });
    } catch (error: any) {
      logger.error('Error getting all users', { error, limit, offset });
      throw new Error(`Failed to get all users: ${error.message}`);
    }
  }
} 