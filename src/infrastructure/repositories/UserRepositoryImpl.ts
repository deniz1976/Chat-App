import { Op, UniqueConstraintError } from 'sequelize';
import { User, UserCreationAttributes, UserStatus } from '../../domain/entities/User';
import { UserRepository, UserUpdate } from '../../domain/repositories/UserRepository';
import { escapeLikePattern } from '../../utils/escapeLikePattern';
import { DuplicateEntityError } from '../../domain/repositories/errors';

export class UserRepositoryImpl implements UserRepository {
  findById(id: string): Promise<User | null> {
    return User.findByPk(id);
  }

  findByIds(ids: string[]): Promise<User[]> {
    return ids.length > 0 ? User.findAll({ where: { id: ids } }) : Promise.resolve([]);
  }

  findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  async existsByUsernameOrEmail(username: string, email: string): Promise<boolean> {
    const count = await User.count({ where: { [Op.or]: [{ username }, { email }] } });
    return count > 0;
  }

  countExisting(ids: string[]): Promise<number> {
    return User.count({ where: { id: ids } });
  }

  async create(data: UserCreationAttributes): Promise<User> {
    try {
      return await User.create(data);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityError('User');
      }
      throw error;
    }
  }

  async update(id: string, data: UserUpdate): Promise<User | null> {
    const user = await User.findByPk(id);
    return user ? user.update(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await User.destroy({ where: { id } });
    return deleted > 0;
  }

  list(limit: number, offset: number): Promise<User[]> {
    return User.findAll({ limit, offset, order: [['username', 'ASC']] });
  }

  search(query: string, limit: number, offset: number): Promise<User[]> {
    const pattern = `%${escapeLikePattern(query)}%`;
    return User.findAll({
      where: {
        [Op.or]: [{ username: { [Op.iLike]: pattern } }, { displayName: { [Op.iLike]: pattern } }],
      },
      limit,
      offset,
      order: [['username', 'ASC']],
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<void> {
    await User.update({ status, lastSeen: new Date() }, { where: { id } });
  }

  async resetStatuses(): Promise<void> {
    await User.update({ status: 'offline' }, { where: { status: { [Op.ne]: 'offline' } } });
  }
}
