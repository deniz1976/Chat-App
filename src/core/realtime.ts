import { UserStatus } from '../domain/entities/User';

export enum RealtimeEventType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  MESSAGE_UPDATED = 'MESSAGE_UPDATED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  TYPING = 'TYPING',
  READ_RECEIPT = 'READ_RECEIPT',
  USER_STATUS = 'USER_STATUS',
  ERROR = 'ERROR',
}

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: unknown;
}

export interface UserStatusPayload {
  userId: string;
  status: UserStatus;
  timestamp: string;
}

export interface RealtimeNotifier {
  sendToUsers(userIds: string[], event: RealtimeEvent, excludeUserId?: string): void;
  isConnected(userId: string): boolean;
}
