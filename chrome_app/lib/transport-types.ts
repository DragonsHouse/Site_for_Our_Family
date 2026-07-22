import type { TransportCheckpoint } from './types';

export type TransportEnvelope<TPayload> = {
  transportKey: string;
  sequence: string | null;
  receivedAt: string;
  payload: TPayload;
};

export type TransportConsumer<TPayload> = (event: TransportEnvelope<TPayload>) => Promise<void>;

export type TransportCheckpointStore = {
  get: (transportKey: string) => Promise<TransportCheckpoint | null>;
  set: (
    checkpoint: Omit<TransportCheckpoint, 'updatedAt'> & Partial<Pick<TransportCheckpoint, 'updatedAt'>>
  ) => Promise<TransportCheckpoint>;
};

export interface StartableTransport {
  transportKey: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
