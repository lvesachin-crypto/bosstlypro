/**
 * Small authenticated PostgREST-shaped reader for restored legacy screens.
 * It intentionally exposes no browser database credentials. The small write
 * surface below is restricted server-side to the restored provider/bundle flow.
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
  private mutation?: "insert" | "update" | "upsert" | "delete";
  private values?: unknown;

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
      const response = await fetch(this.mutation ? "/api/legacy/mutate" : "/api/legacy/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          table: this.table, filters: this.filters, order: this.sort, limit: this.take,
          range: this.page, select: this.selected, action: this.mutation, values: this.values,
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
  insert(values?: unknown): this { this.mutation = "insert"; this.values = values; return this; }
  update(values?: unknown): this { this.mutation = "update"; this.values = values; return this; }
  upsert(values?: unknown): this { this.mutation = "upsert"; this.values = values; return this; }
  delete(): this { this.mutation = "delete"; return this; }
}

export const supabase: any = {
  from: (table: string) => new LegacyQuery(table),
  rpc: async (name: string, args?: Record<string, unknown>): Promise<Result> => {
    if (!["get_admin_users_summary", "reschedule_organic_run"].includes(name)) {
      return unavailable("This legacy RPC is unavailable through the current API.");
    }
    try {
      const response = await fetch("/api/legacy/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, args }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) return unavailable(body.error || `Legacy RPC failed (${response.status})`);
      return { data: body.data, error: null };
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "Legacy RPC failed");
    }
  },
  functions: {
    invoke: async (name: string, options?: { body?: unknown; headers?: Record<string, string> }) => {
      const functionPaths: Record<string, string> = {
        "user-provider-manage": "/api/functions/user-provider-manage",
        "process-engagement-order": "/api/functions/process-engagement-order",
      };
      const path = functionPaths[name];
      if (!path) return unavailable("This legacy function is unavailable.");
      try {
        const headers = { "Content-Type": "application/json", ...(options?.headers ?? {}) };
        // Clerk authenticates this same-origin request with its session cookie.
        // The compatibility marker only satisfies old callers that expect a session.
        if (headers.Authorization === "Bearer legacy-cookie") delete headers.Authorization;
        const response = await fetch(path, { method: "POST", headers, credentials: "same-origin", body: JSON.stringify(options?.body ?? {}) });
        const body = await response.json().catch(() => ({}));
        return !response.ok || body.error ? unavailable(body.error || `Provider request failed (${response.status})`) : { data: body, error: null };
      } catch (error) { return unavailable(error instanceof Error ? error.message : "Provider request failed"); }
    },
  },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "legacy-cookie" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: { from: () => ({ upload: async () => unavailable("Legacy storage writes are unavailable."), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => undefined,
};