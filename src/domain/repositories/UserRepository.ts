import { User, UserCreationAttributes } from '../entities/User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(userData: UserCreationAttributes): Promise<User>;
  update(id: string, userData: Partial<UserCreationAttributes>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  updateStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<User | null>;
  updateLastSeen(id: string, lastSeen: Date): Promise<User | null>;
  search(query: string, limit?: number, offset?: number): Promise<User[]>;
  getAll(limit?: number, offset?: number): Promise<User[]>;
} 