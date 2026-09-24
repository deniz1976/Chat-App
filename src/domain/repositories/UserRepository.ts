import { User, UserCreationAttributes, UserRole, UserStatus } from '../entities/User';

export interface UserUpdate {
  displayName?: string;
  profileImage?: string | null;
  role?: UserRole;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  existsByUsernameOrEmail(username: string, email: string): Promise<boolean>;
  countExisting(ids: string[]): Promise<number>;
  create(data: UserCreationAttributes): Promise<User>;
  update(id: string, data: UserUpdate): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  list(limit: number, offset: number): Promise<User[]>;
  search(query: string, limit: number, offset: number): Promise<User[]>;
  updateStatus(id: string, status: UserStatus): Promise<void>;
  resetStatuses(): Promise<void>;
}
