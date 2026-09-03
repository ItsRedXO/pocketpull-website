import { BACKEND_BASE } from './backend';

type TokenProvider = () => Promise<string | null>;

function getAdminSecret(): string | null {
  try {
    return globalThis.localStorage?.getItem('pocketpull_admin_pass') ?? null;
  } catch {
    return null;
  }
}

async function request<T>(tokenProvider: TokenProvider, body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-DB-Table': String(body.table || '') };
  try {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  const adminSecret = getAdminSecret();
  if (adminSecret) headers['X-Admin-Secret'] = adminSecret;
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
  const list = <T = any>(options: any = {}) => request<T[]>(tokenProvider, { table, operation: 'list', ...options });
  const get = <T = any>(id: string) => request<T>(tokenProvider, { table, operation: 'get', id });
  const count = <T = number>(options: any = {}) => request<T>(tokenProvider, { table, operation: 'count', ...options });
  return {
    get,
    count,
    findFirst: async <T = any>(options: any = {}) => (await list<T>(options))[0] ?? null,
    findMany: list,
    list,
    create: <T = any>(data: Record<string, unknown>) => request<T>(tokenProvider, { table, operation: 'create', data }),
    createMany: async <T = any>(rows: Record<string, unknown>[]) => {
      const results: T[] = [];
      for (const data of rows) results.push(await request<T>(tokenProvider, { table, operation: 'create', data }));
      return results;
    },
    update: <T = any>(id: string, data: Record<string, unknown>) => request<T>(tokenProvider, { table, operation: 'update', id, data }),
    delete: (id: string) => request<void>(tokenProvider, { table, operation: 'delete', id }),
    deleteMany: async (options: any = {}) => {
      const rows = await list<any>(options);
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
