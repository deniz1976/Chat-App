import { ConnectionRegistry } from './infrastructure/realtime/ConnectionRegistry';
import { UserRepositoryImpl } from './infrastructure/repositories/UserRepositoryImpl';
import { ChatRepositoryImpl } from './infrastructure/repositories/ChatRepositoryImpl';
import { MessageRepositoryImpl } from './infrastructure/repositories/MessageRepositoryImpl';
import { AuthService } from './core/services/AuthService';
import { UserService } from './core/services/UserService';
import { ChatService } from './core/services/ChatService';
import { MessageService } from './core/services/MessageService';
import { PresenceService } from './core/services/PresenceService';

const userRepository = new UserRepositoryImpl();
const chatRepository = new ChatRepositoryImpl();
const messageRepository = new MessageRepositoryImpl();

export const connectionRegistry = new ConnectionRegistry();

export const authService = new AuthService(userRepository);
export const userService = new UserService(userRepository);
export const chatService = new ChatService(chatRepository, userRepository);
export const messageService = new MessageService(messageRepository, chatRepository, chatService, connectionRegistry);
export const presenceService = new PresenceService(userRepository, chatRepository, connectionRegistry);
