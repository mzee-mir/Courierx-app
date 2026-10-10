import { SocketService } from './socket';

/**
 * Decouples controllers from the server lifecycle.
 * index.ts creates the SocketService bound to the HTTP server and registers it
 * here; controllers import getSocketService() instead of `import { socketService } from '..'`,
 * which previously created a circular import that booted the whole index.ts
 * (Firebase init, DB connect, cron, server.listen) whenever app.ts was loaded.
 */
let instance: SocketService | null = null;

export function registerSocketService(socket: SocketService): void {
  instance = socket;
}

export function getSocketService(): SocketService {
  if (!instance) {
    throw new Error('SocketService accessed before registration');
  }
  return instance;
}
