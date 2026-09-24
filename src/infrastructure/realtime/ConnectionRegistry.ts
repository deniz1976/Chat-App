import { WebSocket } from 'ws';

export class ConnectionRegistry {
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

    connectedUserIds(): string[] {
        return Array.from(this.connections.keys());
    }

    isConnected(userId: string): boolean {
        return this.connections.has(userId);
    }

    sendToUser(userId: string, payload: string): number {
        let sent = 0;
        this.connections.get(userId)?.forEach(socket => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(payload);
                sent++;
            }
        });
        return sent;
    }
}
