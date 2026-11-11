import WebSocket from 'ws';
import type { ServerMessage } from '../../server/protocol.js';
import { waitFor } from './helpers.js';

/** A real WebSocket client that records what the server sends. */
export class TestClient {
  messages: ServerMessage[] = [];
  closeCode: number | null = null;
  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => this.messages.push(JSON.parse(data.toString()) as ServerMessage));
    ws.on('close', (code) => (this.closeCode = code));
  }

  static async connect(port: number): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return new TestClient(ws);
  }

  send(message: unknown): void {
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /** The first message of this type, once it has arrived. */
  async next<T extends ServerMessage['t']>(type: T, after = 0): Promise<Extract<ServerMessage, { t: T }>> {
    await waitFor(() => this.messages.slice(after).some((m) => m.t === type), 5000);
    return this.messages.slice(after).find((m) => m.t === type) as Extract<ServerMessage, { t: T }>;
  }

  async closed(): Promise<number> {
    await waitFor(() => this.closeCode !== null, 5000);
    return this.closeCode as number;
  }

  close(): void {
    this.ws.close();
  }
}
