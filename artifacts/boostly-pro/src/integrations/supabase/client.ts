/**
 * Compatibility boundary for restored legacy UI modules.
 *
 * The original screens used the Supabase browser client directly. Authentication
 * and application data now go through Clerk and the Replit API, so this adapter
 * intentionally never performs a browser-side database operation. It preserves
 * the original query result contract and makes unavailable operations explicit.
 */
const unavailable = () => ({ data: null, error: new Error("This legacy data operation is unavailable through the current API.") });

const query = new Proxy({}, {
  get(_target, property) {
    if (property === "then") return (resolve: (value: ReturnType<typeof unavailable>) => void) => resolve(unavailable());
    if (property === "catch") return undefined;
    if (property === "single" || property === "maybeSingle") return () => Promise.resolve(unavailable());
    return () => query;
  },
});

export const supabase: any = {
  from: () => query,
  rpc: async () => unavailable(),
  functions: { invoke: async () => unavailable() },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => undefined,
};