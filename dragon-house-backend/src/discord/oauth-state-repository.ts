import type { DiscordOAuthState } from '../types.js';

export interface DiscordOAuthStateRepository {
  create(state: DiscordOAuthState): Promise<DiscordOAuthState>;
  getByStateId(stateId: string): Promise<DiscordOAuthState | null>;
  consume(stateId: string, now: Date): Promise<DiscordOAuthState | null>;
}

export class InMemoryDiscordOAuthStateRepository implements DiscordOAuthStateRepository {
  private readonly states = new Map<string, DiscordOAuthState>();

  async create(state: DiscordOAuthState): Promise<DiscordOAuthState> {
    this.states.set(state.stateId, state);
    return state;
  }

  async getByStateId(stateId: string): Promise<DiscordOAuthState | null> {
    return this.states.get(stateId) ?? null;
  }

  async consume(stateId: string, now: Date): Promise<DiscordOAuthState | null> {
    const state = this.states.get(stateId);
    if (!state || state.consumedAt || new Date(state.expiresAt).getTime() <= now.getTime()) {
      return null;
    }
    const consumedState = { ...state, consumedAt: now.toISOString() };
    this.states.set(stateId, consumedState);
    return consumedState;
  }
}
