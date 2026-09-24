import type { LastMessage, Message, UserStatus } from '../api/types';

export type RealtimeEvent =
  | { type: 'NEW_MESSAGE'; payload: Message }
  | { type: 'MESSAGE_UPDATED'; payload: { message: Message; isLastMessage: boolean } }
  | { type: 'MESSAGE_DELETED'; payload: { chatId: string; messageId: string; lastMessage?: LastMessage | null } }
  | { type: 'READ_RECEIPT'; payload: { chatId: string; readerId: string; messageIds: string[] } }
  | { type: 'TYPING'; payload: { chatId: string; userId: string; isTyping: boolean } }
  | { type: 'USER_STATUS'; payload: { userId: string; status: UserStatus; timestamp: string } }
  | { type: 'CHAT_CREATED' | 'CHAT_UPDATED' | 'CHAT_REMOVED'; payload: { chatId: string } }
  | { type: 'ERROR'; payload: { message: string } };

export type ConnectionState = 'connecting' | 'open' | 'closed';

type EventListener = (event: RealtimeEvent) => void;
type StateListener = (state: ConnectionState) => void;

const MAX_RETRY_DELAY_MS = 15000;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private retries = 0;
  private retryTimer: number | undefined;
  private stopped = true;
  private readonly eventListeners = new Set<EventListener>();
  private readonly stateListeners = new Set<StateListener>();

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close(1000, 'Client closed');
    this.socket = null;
  }

  send(type: 'TYPING' | 'READ_RECEIPT', payload: object): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    this.socket = socket;
    this.emitState('connecting');

    socket.addEventListener('open', () => {
      this.retries = 0;
      this.emitState('open');
    });

    socket.addEventListener('message', (message) => {
      try {
        const event = JSON.parse(message.data) as RealtimeEvent;
        this.eventListeners.forEach((listener) => listener(event));
      } catch {
        return;
      }
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.emitState('closed');
      if (!this.stopped) {
        const delay = Math.min(1000 * 2 ** this.retries, MAX_RETRY_DELAY_MS);
        this.retries += 1;
        this.retryTimer = window.setTimeout(() => this.connect(), delay);
      }
    });
  }

  private emitState(state: ConnectionState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }
}
