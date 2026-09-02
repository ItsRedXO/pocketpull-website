const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

type TokenProvider = () => Promise<string | null>;

async function request<T>(tokenProvider: TokenProvider, body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  const res = await fetch(`${BACKEND_BASE}/db`, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await res.json() as any;
  if (!res.ok) {
    const error: any = new Error(payload?.error || `Database API error ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return payload?.data as T;
}

function tableClient(tokenProvider: TokenProvider, table: string) {
  return {
    get: <T = any>(id: string) => request<T>(tokenProvider, { table, operation: 'get', id }),
    list: <T = any>(options: any = {}) => request<T[]>(tokenProvider, { table, operation: 'list', ...options }),
    create: <T = any>(data: Record<string, unknown>) => request<T>(tokenProvider, { table, operation: 'create', data }),
    createMany: async <T = any>(rows: Record<string, unknown>[]) => {
      const results: T[] = [];
      for (const data of rows) results.push(await request<T>(tokenProvider, { table, operation: 'create', data }));
      return results;
    },
    update: <T = any>(id: string, data: Record<string, unknown>) => request<T>(tokenProvider, { table, operation: 'update', id, data }),
    delete: (id: string) => request<void>(tokenProvider, { table, operation: 'delete', id }),
    deleteMany: async (options: any = {}) => {
      const rows = await request<any[]>(tokenProvider, { table, operation: 'list', ...options });
      for (const row of rows) await request<void>(tokenProvider, { table, operation: 'delete', id: row.id });
      return rows.length;
    },
    upsert: <T = any>(data: Record<string, unknown>) => request<T>(tokenProvider, { table, operation: 'upsert', data }),
  };
}

export function createPostgresDb(tokenProvider: TokenProvider) {
  const cache = new Map<string, any>();
  const db: any = {
    table<T = any>(name: string) {
      if (!cache.has(name)) cache.set(name, tableClient(tokenProvider, name));
      return cache.get(name) as T;
    },
  };

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'table') return target.table.bind(target);
      if (typeof property === 'string') {
        if (!cache.has(property)) cache.set(property, tableClient(tokenProvider, property));
        return cache.get(property);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
