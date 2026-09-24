import { WebSocket } from 'ws';
import { RealtimeEvent, RealtimeNotifier } from '../../core/realtime';

export class ConnectionRegistry implements RealtimeNotifier {
    private readonly connections = new Map<string, Set<WebSocket>>();

    add(userId: string, socket: WebSocket): boolean {
        const sockets = this.connections.get(userId);
        if (sockets) {
            sockets.add(socket);
            return false;
        }
        this.connections.set(userId, new Set([socket]));
        return true;
    }

    remove(userId: string, socket: WebSocket): boolean {
        const sockets = this.connections.get(userId);
        if (!sockets || !sockets.delete(socket)) {
            return false;
        }
        if (sockets.size === 0) {
            this.connections.delete(userId);
            return true;
        }
        return false;
    }

    isConnected(userId: string): boolean {
        return this.connections.has(userId);
    }

    sendToUsers(userIds: string[], event: RealtimeEvent, excludeUserId?: string): void {
        const payload = JSON.stringify(event);
        new Set(userIds).forEach(userId => {
            if (userId === excludeUserId) {
                return;
            }
            this.connections.get(userId)?.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload);
                }
            });
        });
    }
}
