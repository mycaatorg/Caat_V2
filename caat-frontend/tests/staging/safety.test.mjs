import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEmptyPublicSchema, assertLocalApiUrl, parseLocalDatabaseUrl } from './safety.mjs';

test('database credentials are accepted only for loopback local Supabase ports', () => {
  assert.equal(parseLocalDatabaseUrl('postgresql://postgres:disposable@127.0.0.1:55432/postgres').port, '55432');
  assert.throws(() => parseLocalDatabaseUrl('postgresql://postgres:localtest@db.example.com:55432/postgres'), /loopback/);
  assert.throws(() => parseLocalDatabaseUrl('postgresql://postgres:localtest@127.0.0.1:5432/postgres'), /loopback/);
});

test('Auth and REST keys are accepted only for loopback local Supabase ports', () => {
  assert.equal(assertLocalApiUrl('http://127.0.0.1:55431').port, '55431');
  assert.throws(() => assertLocalApiUrl('https://project.supabase.co'), /loopback/);
  assert.throws(() => assertLocalApiUrl('http://127.0.0.1:3000'), /loopback/);
});

test('bootstrap refuses any preflight result except an empty app schema', () => {
  assert.doesNotThrow(() => assertEmptyPublicSchema('empty'));
  assert.throws(() => assertEmptyPublicSchema('nonempty'), /Refusing to overwrite/);
  assert.throws(() => assertEmptyPublicSchema(''), /Refusing to overwrite/);
});
