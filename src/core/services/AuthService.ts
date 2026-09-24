import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { DuplicateEntityError } from '../../domain/repositories/errors';
import { ConflictError, UnauthorizedError } from '../errors';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName: string;
  profileImage?: string;
}

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(input: RegisterInput): Promise<User> {
    if (await this.users.existsByUsernameOrEmail(input.username, input.email)) {
      throw new ConflictError('Username or email already exists');
    }
    try {
      return await this.users.create(input);
    } catch (error) {
      if (error instanceof DuplicateEntityError) {
        throw new ConflictError('Username or email already exists');
      }
      throw error;
    }
  }

  findUser(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await user.comparePassword(password))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    return user;
  }
}
