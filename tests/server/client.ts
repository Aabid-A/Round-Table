import WebSocket from 'ws';
import type { ServerMessage } from '../../server/protocol.js';
import { emptyAnswer, formFor } from '../../web/src/play/human.js';
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

  /** Answer every turn at once, the first choice each time, with a note naming the turn. */
  autoplay(label: string): void {
    this.ws.on('message', (data) => {
      const m = JSON.parse(data.toString()) as ServerMessage;
      if (m.t !== 'turn') return;
      const spec = formFor(m.phase, m.options);
      this.send({
        t: 'answer',
        turn: m.turn,
        answer: { ...emptyAnswer(), speech: spec.speechLabel ? 'I have a feeling about this.' : '', message: spec.messageLabel ? 'because' : '', note: `HUMANNOTE-${label}-${m.turn}`, choice: spec.choices[0]!.value },
      });
    });
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
