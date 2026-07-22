import type { QuantBuyerPageData } from './types';
import type {
  StartableTransport,
  TransportCheckpointStore,
  TransportConsumer
} from './transport-types';

type BuyerSocketTransportOptions = {
  endpointUrl?: string | null;
  transportKey?: string;
  checkpointStore: TransportCheckpointStore;
  onBuyerPageData: TransportConsumer<QuantBuyerPageData>;
};

// MV3 note:
// This is a reconnectable skeleton for future socket support.
// A service worker is not guaranteed to stay alive forever, so production socket
// usage must support reconnect + checkpoint resume.
export class BuyerSocketTransport implements StartableTransport {
  readonly transportKey: string;
  private endpointUrl: string | null;
  private checkpointStore: TransportCheckpointStore;
  private onBuyerPageData: TransportConsumer<QuantBuyerPageData>;
  private socket: WebSocket | null = null;
  private started = false;

  constructor(options: BuyerSocketTransportOptions) {
    this.transportKey = options.transportKey ?? 'buyer-socket';
    this.endpointUrl = options.endpointUrl ?? null;
    this.checkpointStore = options.checkpointStore;
    this.onBuyerPageData = options.onBuyerPageData;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (!this.endpointUrl) {
      console.info(`[${this.transportKey}] endpoint is not configured; transport is idle`);
      return;
    }

    const checkpoint = await this.checkpointStore.get(this.transportKey);
    const resumeFrom = checkpoint?.lastSequence ?? null;
    const url = new URL(this.endpointUrl);
    if (resumeFrom) {
      url.searchParams.set('resume_from', resumeFrom);
    }

    try {
      this.socket = new WebSocket(url.toString());
      this.attachSocketHandlers();
      console.info(`[${this.transportKey}] connecting to ${url.toString()}`);
    } catch (error) {
      console.warn(`[${this.transportKey}] failed to create socket`, error);
      this.started = false;
    }
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // no-op
      }
      this.socket = null;
    }
  }

  private attachSocketHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.info(`[${this.transportKey}] connected`);
    };

    this.socket.onclose = () => {
      console.info(`[${this.transportKey}] disconnected`);
      this.socket = null;
      // Reconnect strategy will be added when real endpoint/protocol is known.
    };

    this.socket.onerror = (event) => {
      console.warn(`[${this.transportKey}] socket error`, event);
    };

    this.socket.onmessage = (event) => {
      void this.handleMessage(event.data);
    };
  }

  private async handleMessage(raw: unknown) {
    try {
      const text = typeof raw === 'string' ? raw : '';
      if (!text) return;

      const parsed = JSON.parse(text) as {
        sequence?: string | null;
        payload?: QuantBuyerPageData;
      };

      if (!parsed.payload) return;

      await this.onBuyerPageData({
        transportKey: this.transportKey,
        sequence: parsed.sequence ?? null,
        receivedAt: new Date().toISOString(),
        payload: parsed.payload
      });

      if (parsed.sequence) {
        await this.checkpointStore.set({
          transportKey: this.transportKey,
          lastSequence: parsed.sequence,
          lastEventAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn(`[${this.transportKey}] failed to process message`, error);
    }
  }
}
