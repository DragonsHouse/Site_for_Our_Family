import type pg from 'pg';
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

type DiscordOAuthStateRow = {
  state_id: string;
  family_member_id: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
};

export class PgDiscordOAuthStateRepository implements DiscordOAuthStateRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(state: DiscordOAuthState): Promise<DiscordOAuthState> {
    const result = await this.pool.query<DiscordOAuthStateRow>(
      `insert into discord_oauth_states
        (state_id, family_member_id, created_at, expires_at, consumed_at)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [state.stateId, state.familyMemberId, state.createdAt, state.expiresAt, state.consumedAt ?? null],
    );
    return mapDiscordOAuthState(result.rows[0]);
  }

  async getByStateId(stateId: string): Promise<DiscordOAuthState | null> {
    const result = await this.pool.query<DiscordOAuthStateRow>(
      'select * from discord_oauth_states where state_id = $1 limit 1',
      [stateId],
    );
    return result.rows[0] ? mapDiscordOAuthState(result.rows[0]) : null;
  }

  async consume(stateId: string, now: Date): Promise<DiscordOAuthState | null> {
    const result = await this.pool.query<DiscordOAuthStateRow>(
      `update discord_oauth_states
       set consumed_at = $2
       where state_id = $1
         and consumed_at is null
         and expires_at > $2
       returning *`,
      [stateId, now.toISOString()],
    );
    return result.rows[0] ? mapDiscordOAuthState(result.rows[0]) : null;
  }
}

function mapDiscordOAuthState(row: DiscordOAuthStateRow): DiscordOAuthState {
  return {
    stateId: row.state_id,
    familyMemberId: row.family_member_id,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    consumedAt: row.consumed_at?.toISOString() ?? null,
  };
}
