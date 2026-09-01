import { describe, expect, test } from 'node:test';
import { normalizeDatabaseConfig } from './db';

describe('normalizeDatabaseConfig', () => {
  test('accepts DATABASE_URL as the primary connection source', () => {
    const config = normalizeDatabaseConfig({
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/pocketpull',
    });

    expect(config.connectionString).toBe('postgresql://user:pass@db.example.com:5432/pocketpull');
  });

  test('builds a connection string from PGHOST-style variables', () => {
    const config = normalizeDatabaseConfig({
      PGHOST: 'db.example.com',
      PGPORT: '5432',
      PGUSER: 'pocketpull',
      PGPASSWORD: 'secret',
      PGDATABASE: 'pocketpull',
      PGSSL: 'true',
    });

    expect(config.connectionString).toBe('postgresql://pocketpull:secret@db.example.com:5432/pocketpull');
    expect(config.ssl).toBe(true);
  });

  test('fails clearly when no postgres configuration exists', () => {
    expect(() => normalizeDatabaseConfig({})).toThrow('PostgreSQL configuration missing');
  });
});
