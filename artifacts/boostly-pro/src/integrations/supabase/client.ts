/**
 * Small authenticated PostgREST-shaped reader for restored legacy screens.
 * It intentionally exposes no browser database credentials and keeps writes,
 * RPCs, storage and external edge functions unavailable.
 */
type Filter = { operator: "eq" | "neq" | "in" | "is"; column: string; value: unknown };
type Result = { data: any; error: Error | null };

const unavailable = (message = "This legacy data operation is unavailable through the current API."): Result => ({
  data: null, error: new Error(message),
});

class LegacyQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private sort?: { column: string; ascending: boolean };
  private take?: number;
  private page?: { from: number; to: number };
  private selected?: string;

  constructor(private readonly table: string) {}

  select(columns = "*"): this { this.selected = columns; return this; }
  eq(column: string, value: unknown): this { this.filters.push({ operator: "eq", column, value }); return this; }
  neq(column: string, value: unknown): this { this.filters.push({ operator: "neq", column, value }); return this; }
  in(column: string, value: unknown[]): this { this.filters.push({ operator: "in", column, value }); return this; }
  is(column: string, value: unknown): this { this.filters.push({ operator: "is", column, value }); return this; }
  order(column: string, options?: { ascending?: boolean }): this {
    this.sort = { column, ascending: options?.ascending !== false }; return this;
  }
  limit(value: number): this { this.take = value; return this; }
  range(from: number, to: number): this { this.page = { from, to }; return this; }
  async execute(): Promise<Result> {
    try {
      const response = await fetch("/api/legacy/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          table: this.table, filters: this.filters, order: this.sort, limit: this.take,
          range: this.page, select: this.selected,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) return unavailable(body.error || `Legacy query failed (${response.status})`);
      return { data: body.data, error: null };
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "Legacy query failed");
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> { return this.execute().then(onfulfilled, onrejected); }
  single(): Promise<Result> {
    return this.execute().then((result) => result.error ? result : result.data?.length === 1
      ? { data: result.data[0], error: null }
      : unavailable(result.data?.length ? "Expected a single row, but multiple rows were returned." : "Expected a single row, but none were returned."));
  }
  maybeSingle(): Promise<Result> {
    return this.execute().then((result) => result.error ? result : result.data?.length > 1
      ? unavailable("Expected at most one row, but multiple rows were returned.")
      : { data: result.data?.[0] ?? null, error: null });
  }
  insert(_values?: unknown): LegacyQuery { return this.unavailableWrite(); }
  update(_values?: unknown): LegacyQuery { return this.unavailableWrite(); }
  upsert(_values?: unknown): LegacyQuery { return this.unavailableWrite(); }
  delete(): LegacyQuery { return this.unavailableWrite(); }
  private unavailableWrite(): LegacyQuery {
    const query = new LegacyQuery(this.table);
    query.execute = async () => unavailable("Legacy writes are unavailable. Payments, provider configuration, and fulfillment are not emulated.");
    return query;
  }
}

export const supabase: any = {
  from: (table: string) => new LegacyQuery(table),
  rpc: async () => unavailable("Legacy RPC operations are unavailable through the current API."),
  functions: { invoke: async () => unavailable("External legacy edge functions are unavailable; payment, provider sync, and fulfillment are not emulated.") },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: { from: () => ({ upload: async () => unavailable("Legacy storage writes are unavailable."), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => undefined,
};