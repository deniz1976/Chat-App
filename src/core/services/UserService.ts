import { User, UserRole } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { BadRequestError, NotFoundError } from '../errors';
import { IncomingFile, UploadKind, UploadService } from './UploadService';

export interface ProfileUpdate {
  displayName?: string;
  profileImage?: string | null;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly uploads: UploadService,
  ) {}

  list(limit: number, offset: number): Promise<User[]> {
    return this.users.list(limit, offset);
  }

  search(query: string, limit: number, offset: number): Promise<User[]> {
    return this.users.search(query, limit, offset);
  }

  async get(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, data: ProfileUpdate): Promise<User> {
    const user = await this.users.update(userId, data);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async changeAvatar(userId: string, file: IncomingFile): Promise<User> {
    const { url } = await this.uploads.upload(userId, UploadKind.AVATAR, file);
    return this.updateProfile(userId, { profileImage: url });
  }

  async changeRole(requesterId: string, userId: string, role: UserRole): Promise<User> {
    if (requesterId === userId) {
      throw new BadRequestError('You cannot change your own role');
    }
    const user = await this.users.update(userId, { role });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async delete(userId: string): Promise<void> {
    if (!(await this.users.delete(userId))) {
      throw new NotFoundError('User not found or already deleted');
    }
  }
}
