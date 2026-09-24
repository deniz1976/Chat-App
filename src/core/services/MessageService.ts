import { Message, MessageType } from '../../domain/entities/Message';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { ChatRepository } from '../../domain/repositories/ChatRepository';
import { BadRequestError, NotFoundError } from '../errors';
import { RealtimeEventType, RealtimeNotifier } from '../realtime';
import { ChatService } from './ChatService';

export interface CreateMessageInput {
  chatId: string;
  content: string;
  type?: MessageType;
  mediaUrl?: string | null;
  replyToId?: string | null;
}

export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly chats: ChatRepository,
    private readonly chatService: ChatService,
    private readonly notifier: RealtimeNotifier,
  ) {}

  async list(chatId: string, userId: string, limit: number, beforeId?: string): Promise<Message[]> {
    await this.chatService.requireMembership(chatId, userId);
    const messages = await this.messages.findPage(chatId, limit, beforeId);
    if (!messages) {
      throw new BadRequestError('Invalid pagination cursor');
    }
    return messages;
  }

  async get(messageId: string, userId: string): Promise<Message> {
    const message = await this.requireMessage(messageId);
    await this.chatService.requireMembership(message.chatId, userId);
    return message;
  }

  async create(senderId: string, input: CreateMessageInput): Promise<Message> {
    const chat = await this.chatService.requireMembership(input.chatId, senderId);

    if (input.replyToId && !(await this.messages.existsInChat(input.replyToId, input.chatId))) {
      throw new BadRequestError('Replied message does not belong to this chat');
    }

    const message = await this.messages.create({
      senderId,
      chatId: input.chatId,
      content: input.content,
      type: input.type ?? MessageType.TEXT,
      mediaUrl: input.mediaUrl || null,
      replyToId: input.replyToId || null,
      readBy: [senderId],
    });

    await this.chats.setLastMessage(input.chatId, message.id);

    this.notifier.sendToUsers(chat.participants, {
      type: RealtimeEventType.NEW_MESSAGE,
      payload: message,
    });

    return message;
  }

  async updateContent(messageId: string, senderId: string, content: string): Promise<Message> {
    const message = await this.messages.updateContent(messageId, senderId, content);
    if (!message) {
      throw new NotFoundError('Message not found or you are not the sender');
    }

    const chat = await this.chats.findById(message.chatId);
    if (chat) {
      this.notifier.sendToUsers(chat.participants, {
        type: RealtimeEventType.MESSAGE_UPDATED,
        payload: { message, isLastMessage: chat.lastMessageId === message.id },
      });
    }
    return message;
  }

  async delete(messageId: string, senderId: string): Promise<void> {
    const message = await this.messages.findById(messageId);
    if (!message || message.senderId !== senderId || !(await this.messages.delete(messageId, senderId))) {
      throw new NotFoundError('Message not found or you are not the sender');
    }

    const chat = await this.chats.findById(message.chatId);
    if (!chat) {
      return;
    }

    let lastMessage: Message | null | undefined;
    if (chat.lastMessageId === messageId) {
      lastMessage = await this.messages.findLatestInChat(chat.id);
      await this.chats.setLastMessage(chat.id, lastMessage?.id ?? null);
    }

    this.notifier.sendToUsers(chat.participants, {
      type: RealtimeEventType.MESSAGE_DELETED,
      payload: { chatId: chat.id, messageId, ...(lastMessage !== undefined && { lastMessage }) },
    });
  }

  async markAsRead(messageId: string, userId: string, expectedChatId?: string): Promise<void> {
    const message = await this.requireMessage(messageId);
    if (expectedChatId && message.chatId !== expectedChatId) {
      throw new NotFoundError('Message not found in this chat');
    }
    const chat = await this.chatService.requireMembership(message.chatId, userId);

    if (await this.messages.markAsRead(messageId, userId)) {
      this.publishReadReceipt(chat.id, chat.participants, userId, [messageId]);
    }
  }

  async markChatAsRead(chatId: string, userId: string): Promise<string[]> {
    const chat = await this.chatService.requireMembership(chatId, userId);
    const messageIds = await this.messages.markChatAsRead(chatId, userId);
    if (messageIds.length > 0) {
      this.publishReadReceipt(chat.id, chat.participants, userId, messageIds);
    }
    return messageIds;
  }

  async countUnread(chatId: string, userId: string): Promise<number> {
    await this.chatService.requireMembership(chatId, userId);
    return this.messages.countUnread(chatId, userId);
  }

  async listMedia(chatId: string, userId: string, limit: number, offset: number): Promise<Message[]> {
    await this.chatService.requireMembership(chatId, userId);
    return this.messages.findMedia(chatId, limit, offset);
  }

  async search(chatId: string, userId: string, query: string, limit: number, offset: number): Promise<Message[]> {
    await this.chatService.requireMembership(chatId, userId);
    return this.messages.search(chatId, query, limit, offset);
  }

  async publishTyping(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    const chat = await this.chatService.requireMembership(chatId, userId);
    this.notifier.sendToUsers(
      chat.participants,
      {
        type: RealtimeEventType.TYPING,
        payload: { chatId, userId, isTyping },
      },
      userId,
    );
  }

  private publishReadReceipt(chatId: string, participants: string[], readerId: string, messageIds: string[]): void {
    this.notifier.sendToUsers(participants, {
      type: RealtimeEventType.READ_RECEIPT,
      payload: { chatId, readerId, messageIds, timestamp: new Date().toISOString() },
    });
  }

  private async requireMessage(messageId: string): Promise<Message> {
    const message = await this.messages.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message not found');
    }
    return message;
  }
}
