const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
delete process.env.VERCEL;

const dbPath = require.resolve('../db');
const calls = [];
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM Auth_Sessions s')) return [[{ user_id: 7, role: 'student', is_admin: 0 }]];
      return [[]];
    }
  }
};

const auth = require('../auth');

test('session tokens stay in an HttpOnly cookie and only hashes reach the database', async () => {
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };

  await auth.createSession(response, 7, false);
  const sessionCookie = headers['Set-Cookie'];
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Strict/);
  assert.doesNotMatch(sessionCookie, /Max-Age=/);

  const token = sessionCookie.split(';')[0].split('=')[1];
  const insert = calls.find(({ sql }) => sql.includes('INSERT INTO Auth_Sessions'));
  assert.notEqual(insert.params[0], token);
  assert.equal(insert.params[0].length, 64);
  assert.equal((await auth.loadSession({ headers: { cookie: sessionCookie.split(';')[0] } })).user_id, 7);

  await auth.endSession({ headers: { cookie: sessionCookie.split(';')[0] } }, response);
  assert.match(headers['Set-Cookie'], /Max-Age=0/);
  assert.ok(calls.some(({ sql }) => sql.includes('DELETE FROM Auth_Sessions WHERE token_hash')));
});
