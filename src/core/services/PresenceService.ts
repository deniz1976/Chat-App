import { UserStatus } from '../../domain/entities/User';
import { ChatRepository } from '../../domain/repositories/ChatRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { RealtimeEventType, RealtimeNotifier, UserStatusPayload } from '../realtime';

export class PresenceService {
  constructor(
    private readonly users: UserRepository,
    private readonly chats: ChatRepository,
    private readonly notifier: RealtimeNotifier,
  ) {}

  resetAll(): Promise<void> {
    return this.users.resetStatuses();
  }

  syncWithConnections(userId: string): Promise<void> {
    return this.setStatus(userId, this.notifier.isConnected(userId) ? 'online' : 'offline');
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.users.updateStatus(userId, status);
    const contactIds = await this.chats.findContactIds(userId);
    const payload: UserStatusPayload = { userId, status, timestamp: new Date().toISOString() };
    this.notifier.sendToUsers(contactIds, { type: RealtimeEventType.USER_STATUS, payload });
  }
}
