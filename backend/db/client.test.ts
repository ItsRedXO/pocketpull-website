import { describe, expect, it } from 'vitest';
import { createPostgresConfig } from './client';

describe('createPostgresConfig', () => {
  it('prefers DATABASE_URL when supplied', () => {
    expect(createPostgresConfig({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/pocketpull_migration' })).toEqual({
      connectionString: 'postgresql://user:pass@localhost:5432/pocketpull_migration',
      max: 10,
    });
  });

  it('builds a connection config from PG* variables', () => {
    expect(createPostgresConfig({
      PGHOST: 'localhost',
      PGPORT: '5432',
      PGUSER: 'postgres',
      PGPASSWORD: 'secret',
      PGDATABASE: 'pocketpull_migration',
    })).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'secret',
      database: 'pocketpull_migration',
      max: 10,
    });
  });

  it('throws when PostgreSQL configuration is missing', () => {
    expect(() => createPostgresConfig({})).toThrow('PostgreSQL configuration missing');
  });
});
