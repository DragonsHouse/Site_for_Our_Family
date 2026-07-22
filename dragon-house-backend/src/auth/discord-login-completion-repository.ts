import type pg from 'pg';

export type DiscordLoginClientType = 'web' | 'chrome_extension';

export type DiscordLoginCompletion = {
  codeHash: string;
  stateId: string;
  familyMemberId: string;
  clientType: DiscordLoginClientType;
  redirectTarget: string;
  environment: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export interface DiscordLoginCompletionRepository {
  create(completion: DiscordLoginCompletion): Promise<DiscordLoginCompletion>;
  getByCodeHash(codeHash: string): Promise<DiscordLoginCompletion | null>;
  consume(codeHash: string, now: Date): Promise<DiscordLoginCompletion | null>;
}

export class InMemoryDiscordLoginCompletionRepository implements DiscordLoginCompletionRepository {
  private readonly completions = new Map<string, DiscordLoginCompletion>();

  async create(completion: DiscordLoginCompletion): Promise<DiscordLoginCompletion> {
    this.completions.set(completion.codeHash, completion);
    return completion;
  }

  async getByCodeHash(codeHash: string): Promise<DiscordLoginCompletion | null> {
    return this.completions.get(codeHash) ?? null;
  }

  async consume(codeHash: string, now: Date): Promise<DiscordLoginCompletion | null> {
    const completion = this.completions.get(codeHash);
    if (!completion || completion.consumedAt || new Date(completion.expiresAt).getTime() <= now.getTime()) return null;
    const consumed = { ...completion, consumedAt: now.toISOString() };
    this.completions.set(codeHash, consumed);
    return consumed;
  }
}

type CompletionRow = {
  code_hash: string;
  state_id: string;
  family_member_id: string;
  client_type: DiscordLoginClientType;
  redirect_target: string;
  environment: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
};

export class PgDiscordLoginCompletionRepository implements DiscordLoginCompletionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(completion: DiscordLoginCompletion): Promise<DiscordLoginCompletion> {
    const result = await this.pool.query<CompletionRow>(
      `insert into discord_login_completions
        (code_hash, state_id, family_member_id, client_type, redirect_target, environment, created_at, expires_at, consumed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        completion.codeHash,
        completion.stateId,
        completion.familyMemberId,
        completion.clientType,
        completion.redirectTarget,
        completion.environment,
        completion.createdAt,
        completion.expiresAt,
        completion.consumedAt,
      ],
    );
    return mapCompletion(result.rows[0]);
  }

  async getByCodeHash(codeHash: string): Promise<DiscordLoginCompletion | null> {
    const result = await this.pool.query<CompletionRow>(
      'select * from discord_login_completions where code_hash = $1 limit 1',
      [codeHash],
    );
    return result.rows[0] ? mapCompletion(result.rows[0]) : null;
  }

  async consume(codeHash: string, now: Date): Promise<DiscordLoginCompletion | null> {
    const result = await this.pool.query<CompletionRow>(
      `update discord_login_completions
       set consumed_at = $2
       where code_hash = $1
         and consumed_at is null
         and expires_at > $2
       returning *`,
      [codeHash, now.toISOString()],
    );
    return result.rows[0] ? mapCompletion(result.rows[0]) : null;
  }
}

function mapCompletion(row: CompletionRow): DiscordLoginCompletion {
  return {
    codeHash: row.code_hash,
    stateId: row.state_id,
    familyMemberId: row.family_member_id,
    clientType: row.client_type,
    redirectTarget: row.redirect_target,
    environment: row.environment,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    consumedAt: row.consumed_at?.toISOString() ?? null,
  };
}
