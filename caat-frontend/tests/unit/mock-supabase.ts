import { vi } from "vitest";

/**
 * Lightweight mock of the Supabase query builder for pure-logic unit tests.
 *
 * The real client exposes a chainable, thenable builder
 * (`.from(t).select().eq().order()` ... awaited, or `.single()`/`.maybeSingle()`).
 * This mock reproduces just enough of that surface to drive our data-layer
 * functions without a database. A `resolver` decides the result for each query
 * from its table + the last mutating verb seen (select | insert | update |
 * delete | upsert), so a function that reads then writes the same table can
 * return different results per operation.
 */

export interface QueryResult<T = unknown> {
  data?: T;
  error?: { message: string } | null;
  count?: number | null;
}

export interface QueryContext {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  calls: { method: string; args: unknown[] }[];
}

type Resolver = (ctx: QueryContext) => QueryResult;
type RpcResolver = (name: string, args: Record<string, unknown>) => QueryResult;

export function createMockSupabase(opts: {
  resolver?: Resolver;
  rpc?: RpcResolver;
  user?: { id: string } | null;
  claimsSub?: string | null;
}) {
  const resolver: Resolver = opts.resolver ?? (() => ({ data: null, error: null }));
  const queries: QueryContext[] = [];

  const from = vi.fn((table: string) => {
    const ctx: QueryContext = { table, op: "select", calls: [] };
    queries.push(ctx);
    const builder: Record<string, unknown> = {};
    const passthrough =
      (method: string, op?: QueryContext["op"]) =>
      (...args: unknown[]) => {
        ctx.calls.push({ method, args });
        if (op) ctx.op = op;
        return builder;
      };
    // Chaining/filtering methods return the builder unchanged.
    for (const m of ["select", "eq", "in", "order", "ilike", "or", "limit", "range", "not", "gte", "lte", "is"]) {
      builder[m] = passthrough(m);
    }
    // Mutating verbs stamp the op so the resolver can branch on read vs write.
    builder.insert = passthrough("insert", "insert");
    builder.update = passthrough("update", "update");
    builder.delete = passthrough("delete", "delete");
    builder.upsert = passthrough("upsert", "upsert");
    // Terminal resolvers.
    builder.single = () => {
      ctx.calls.push({ method: "single", args: [] });
      return Promise.resolve(resolver(ctx));
    };
    builder.maybeSingle = () => {
      ctx.calls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve(resolver(ctx));
    };
    builder.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolver(ctx)).then(onFulfilled, onRejected);
    return builder;
  });

  const rpc = vi.fn((name: string, args: Record<string, unknown>) =>
    Promise.resolve(opts.rpc ? opts.rpc(name, args) : { data: [], error: null }),
  );

  const auth = {
    getUser: vi.fn(() => Promise.resolve({ data: { user: opts.user ?? null }, error: null })),
    getClaims: vi.fn(() =>
      Promise.resolve({
        data: opts.claimsSub === undefined ? null : { claims: { sub: opts.claimsSub } },
        error: null,
      }),
    ),
  };

  return { from, rpc, auth, queries };
}
