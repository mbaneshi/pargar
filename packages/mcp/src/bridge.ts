import { WebSocketServer, WebSocket } from 'ws';
import type { KernelBridge, CommandResult } from './kernel-bridge.js';

const BRIDGE_PORT = 3100;

export interface BridgeServer {
  hasBrowserConnection(): boolean;
  executeInBrowser(cmd: object): Promise<CommandResult>;
  queryBrowser(method: string): Promise<string>;
  close(): void;
}

export function startBridge(fallbackKernel: KernelBridge): BridgeServer {
  let browserSocket: WebSocket | null = null;
  let pendingRequests = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  let nextRequestId = 1;

  let wss: WebSocketServer | null = null;
  try {
    wss = new WebSocketServer({ port: BRIDGE_PORT });
  } catch {
    process.stderr.write(
      `[nexus-mcp] WebSocket bridge port ${BRIDGE_PORT} unavailable, running without browser bridge\n`,
    );
  }

  wss?.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(
        `[nexus-mcp] Port ${BRIDGE_PORT} in use, running without browser bridge\n`,
      );
      wss?.close();
      wss = null;
    }
  });

  wss?.on('connection', (ws) => {
    browserSocket = ws;
    process.stderr.write(`[nexus-mcp] Browser connected via WebSocket\n`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response' && msg.id) {
          const pending = pendingRequests.get(msg.id);
          if (pending) {
            pendingRequests.delete(msg.id);
            pending.resolve(msg.result);
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      process.stderr.write(`[nexus-mcp] Browser disconnected\n`);
      browserSocket = null;
      for (const [, pending] of pendingRequests) {
        pending.reject(new Error('Browser disconnected'));
      }
      pendingRequests.clear();
    });
  });

  wss?.on('listening', () => {
    process.stderr.write(
      `[nexus-mcp] WebSocket bridge listening on ws://localhost:${BRIDGE_PORT}\n`,
    );
  });

  function sendToBrowser(msg: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!browserSocket || browserSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('No browser connection'));
        return;
      }
      const id = nextRequestId++;
      pendingRequests.set(id, { resolve, reject });
      browserSocket.send(JSON.stringify({ ...msg, id }));

      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Browser response timeout'));
        }
      }, 10000);
    });
  }

  return {
    hasBrowserConnection(): boolean {
      return browserSocket !== null && browserSocket.readyState === WebSocket.OPEN;
    },

    async executeInBrowser(cmd: object): Promise<CommandResult> {
      if (!this.hasBrowserConnection()) {
        return fallbackKernel.executeCommand(cmd);
      }
      try {
        return await sendToBrowser({ type: 'execute_command', command: cmd });
      } catch {
        return fallbackKernel.executeCommand(cmd);
      }
    },

    async queryBrowser(method: string): Promise<string> {
      if (!this.hasBrowserConnection()) {
        switch (method) {
          case 'get_entities':
            return fallbackKernel.getEntitiesJson();
          case 'get_layers':
            return fallbackKernel.getLayersJson();
          default:
            return '{}';
        }
      }
      try {
        return await sendToBrowser({ type: 'query', method });
      } catch {
        switch (method) {
          case 'get_entities':
            return fallbackKernel.getEntitiesJson();
          case 'get_layers':
            return fallbackKernel.getLayersJson();
          default:
            return '{}';
        }
      }
    },

    close() {
      wss?.close();
    },
  };
}
