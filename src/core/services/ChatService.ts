import { Chat, ChatType } from '../../domain/entities/Chat';
import { User } from '../../domain/entities/User';
import { ChatRepository, ChatUpdate } from '../../domain/repositories/ChatRepository';
import { MessageRepository } from '../../domain/repositories/MessageRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { DuplicateEntityError } from '../../domain/repositories/errors';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { RealtimeEventType, RealtimeNotifier } from '../realtime';

export interface CreateChatInput {
  name?: string | null;
  type: ChatType;
  participants: string[];
  avatar?: string | null;
}

export interface ChatView {
  chat: Chat;
  members: User[];
  unreadCount: number;
}

export interface CreateChatResult {
  view: ChatView;
  created: boolean;
}

export class ChatService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly users: UserRepository,
    private readonly messages: MessageRepository,
    private readonly notifier: RealtimeNotifier,
  ) {}

  async listForUser(userId: string): Promise<ChatView[]> {
    return this.buildViews(await this.chats.findForUser(userId), userId);
  }

  async getForUser(chatId: string, userId: string): Promise<ChatView> {
    const chat = await this.chats.findByIdWithDetails(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }
    this.assertParticipant(chat, userId);
    const [view] = await this.buildViews([chat], userId);
    return view;
  }

  async requireMembership(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chats.findById(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }
    this.assertParticipant(chat, userId);
    return chat;
  }

  async create(userId: string, input: CreateChatInput): Promise<CreateChatResult> {
    const { chat, created } =
      input.type === ChatType.GROUP
        ? { chat: await this.createGroup(userId, input), created: true }
        : await this.findOrCreateDirect(userId, input);
    if (created) {
      this.notify(RealtimeEventType.CHAT_CREATED, chat.id, chat.participants);
    }
    return { view: await this.getForUser(chat.id, userId), created };
  }

  async update(chatId: string, userId: string, data: ChatUpdate): Promise<ChatView> {
    const chat = await this.requireChat(chatId);
    if (chat.type === ChatType.DIRECT) {
      throw new ForbiddenError('Cannot update details of a direct chat');
    }
    this.assertAdmin(chat, userId, 'Only admins or the creator can update group chat details');
    if (data.name === undefined && data.avatar === undefined) {
      throw new BadRequestError('No update data provided');
    }
    await this.chats.update(chatId, data);
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, chat.participants);
    return this.getForUser(chatId, userId);
  }

  async delete(chatId: string, userId: string): Promise<void> {
    const chat = await this.requireChat(chatId);
    if (chat.createdBy !== userId) {
      throw new ForbiddenError('Only the creator can delete this chat');
    }
    await this.chats.delete(chatId);
    this.notify(RealtimeEventType.CHAT_REMOVED, chatId, chat.participants);
  }

  async addParticipant(chatId: string, requesterId: string, userId: string): Promise<string[]> {
    const chat = await this.requireGroup(chatId, 'Cannot add participants to a direct chat');
    this.assertAdmin(chat, requesterId, 'Only admins or the creator can add participants');
    if ((await this.users.countExisting([userId])) === 0) {
      throw new NotFoundError('User not found');
    }
    const participants = await this.chats.addParticipant(chatId, userId);
    if (!participants) {
      throw new ConflictError('User is already a participant');
    }
    this.notify(RealtimeEventType.CHAT_CREATED, chatId, [userId]);
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, chat.participants);
    return participants;
  }

  async removeParticipant(chatId: string, requesterId: string, userId: string): Promise<string[]> {
    if (userId === requesterId) {
      throw new BadRequestError('You cannot remove yourself using this endpoint. Use POST /chats/:id/leave instead.');
    }
    const chat = await this.requireGroup(chatId, 'Cannot remove participants from a direct chat');
    this.assertAdmin(chat, requesterId, 'Only admins or the creator can remove participants');
    if (userId === chat.createdBy) {
      throw new BadRequestError('Cannot remove the chat creator');
    }
    const participants = await this.chats.removeParticipant(chatId, userId);
    if (!participants) {
      throw new NotFoundError('User is not a participant in this chat');
    }
    this.notify(RealtimeEventType.CHAT_REMOVED, chatId, [userId]);
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, participants);
    return participants;
  }

  async leave(chatId: string, userId: string): Promise<void> {
    const chat = await this.chats.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      throw new NotFoundError('Chat not found');
    }
    if (chat.type !== ChatType.GROUP) {
      throw new BadRequestError('Cannot leave a direct chat');
    }
    if (chat.createdBy === userId) {
      throw new BadRequestError('The chat creator cannot leave the chat. Delete the chat instead.');
    }
    const participants = await this.chats.removeParticipant(chatId, userId);
    this.notify(RealtimeEventType.CHAT_REMOVED, chatId, [userId]);
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, participants ?? []);
  }

  async addAdmin(chatId: string, requesterId: string, userId: string): Promise<string[]> {
    const chat = await this.requireGroup(chatId, 'Cannot manage admins in a direct chat');
    this.assertAdmin(chat, requesterId, 'Only admins or the creator can add new admins');
    if (!chat.participants.includes(userId)) {
      throw new BadRequestError('Cannot make a non-participant an admin');
    }
    const admins = await this.chats.addAdmin(chatId, userId);
    if (!admins) {
      throw new ConflictError('User is already an admin');
    }
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, chat.participants);
    return admins;
  }

  async removeAdmin(chatId: string, requesterId: string, userId: string): Promise<string[]> {
    const chat = await this.requireGroup(chatId, 'Cannot manage admins in a direct chat');
    if (userId === chat.createdBy) {
      throw new BadRequestError('Cannot remove the chat creator from admins');
    }
    this.assertAdmin(chat, requesterId, 'Only admins or the creator can remove admins');
    const admins = await this.chats.removeAdmin(chatId, userId);
    if (!admins) {
      throw new NotFoundError('User is not an admin in this chat');
    }
    this.notify(RealtimeEventType.CHAT_UPDATED, chatId, chat.participants);
    return admins;
  }

  private async createGroup(userId: string, input: CreateChatInput): Promise<Chat> {
    if (!input.name) {
      throw new BadRequestError('Group chats require a name');
    }
    const participants = [...new Set([userId, ...input.participants])];
    await this.assertUsersExist(participants);
    return this.chats.create({
      name: input.name,
      type: ChatType.GROUP,
      avatar: input.avatar ?? null,
      createdBy: userId,
      participants,
      admins: [userId],
      directKey: null,
    });
  }

  private async findOrCreateDirect(userId: string, input: CreateChatInput): Promise<{ chat: Chat; created: boolean }> {
    if (input.participants.length !== 1) {
      throw new BadRequestError('Direct chats must have exactly one participant (other than yourself)');
    }
    const otherUserId = input.participants[0];
    if (otherUserId === userId) {
      throw new BadRequestError('You cannot start a direct chat with yourself');
    }

    const directKey = Chat.buildDirectKey(userId, otherUserId);
    const existing = await this.chats.findByDirectKey(directKey);
    if (existing) {
      return { chat: existing, created: false };
    }

    await this.assertUsersExist([userId, otherUserId]);

    try {
      const chat = await this.chats.create({
        name: null,
        type: ChatType.DIRECT,
        avatar: input.avatar ?? null,
        createdBy: userId,
        participants: [userId, otherUserId],
        admins: [userId],
        directKey,
      });
      return { chat, created: true };
    } catch (error) {
      if (error instanceof DuplicateEntityError) {
        const concurrent = await this.chats.findByDirectKey(directKey);
        if (concurrent) {
          return { chat: concurrent, created: false };
        }
      }
      throw error;
    }
  }

  private notify(type: RealtimeEventType, chatId: string, userIds: string[]): void {
    this.notifier.sendToUsers(userIds, { type, payload: { chatId } });
  }

  private async buildViews(chats: Chat[], userId: string): Promise<ChatView[]> {
    const [members, unread] = await Promise.all([
      this.users.findByIds([...new Set(chats.flatMap((chat) => chat.participants))]),
      this.messages.countUnreadByChat(
        chats.map((chat) => chat.id),
        userId,
      ),
    ]);
    const membersById = new Map(members.map((member) => [member.id, member]));
    return chats.map((chat) => ({
      chat,
      members: chat.participants.flatMap((id) => membersById.get(id) ?? []),
      unreadCount: unread.get(chat.id) ?? 0,
    }));
  }

  private async assertUsersExist(userIds: string[]): Promise<void> {
    if ((await this.users.countExisting(userIds)) !== userIds.length) {
      throw new NotFoundError('One or more participants do not exist');
    }
  }

  private async requireChat(chatId: string): Promise<Chat> {
    const chat = await this.chats.findById(chatId);
    if (!chat) {
      throw new NotFoundError('Chat not found');
    }
    return chat;
  }

  private async requireGroup(chatId: string, message: string): Promise<Chat> {
    const chat = await this.requireChat(chatId);
    if (chat.type !== ChatType.GROUP) {
      throw new BadRequestError(message);
    }
    return chat;
  }

  private assertParticipant(chat: Chat, userId: string): void {
    if (!chat.participants.includes(userId)) {
      throw new ForbiddenError('You are not a participant in this chat');
    }
  }

  private assertAdmin(chat: Chat, userId: string, message: string): void {
    if (!chat.admins.includes(userId) && chat.createdBy !== userId) {
      throw new ForbiddenError(message);
    }
  }
}
