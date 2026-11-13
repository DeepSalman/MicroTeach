const test = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../db');
const authPath = require.resolve('../auth');

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      if (sql.includes('FROM Posts WHERE post_id')) return [[{ user_id: 2 }]];
      if (sql.includes('FROM Conversation_Members WHERE')) {
        return [params[1] === 2 ? [{ user_id: 2 }] : []];
      }
      if (sql.includes('FROM Post_Applications pa JOIN Posts p')) {
        return [[{
          applicant_id: 3,
          owner_id: 2,
          status: 'pending',
          completion_requested_by: null
        }]];
      }
      return [[]];
    }
  }
};
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: { loadSession: async (req) => req.testUser || null }
};

const access = require('../access');

async function request(area, method, path, testUser, body = {}) {
  const req = { method, path, testUser, body };
  const res = {
    code: 200,
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; }
  };
  let passed = false;
  await access(area)(req, res, () => { passed = true; });
  return { code: res.code, passed, body: req.body };
}

const user = { user_id: 2, is_admin: 0 };
const administrator = { user_id: 1, is_admin: 1 };

test('public posts remain visible while private endpoints require a session', async () => {
  assert.equal((await request('posts', 'GET', '/', null)).passed, true);
  assert.equal((await request('master-data', 'GET', '/transactions', null)).code, 401);
});

test('admin endpoints reject ordinary users', async () => {
  assert.equal((await request('users', 'GET', '/', user)).code, 403);
  assert.equal((await request('users', 'GET', '/', administrator)).passed, true);
  assert.equal((await request('teacher-applications', 'GET', '/documents/1/file', user)).code, 403);
  assert.equal((await request('teacher-applications', 'GET', '/documents/1/file', administrator)).passed, true);
});

test('identity comes from the session rather than request parameters', async () => {
  assert.equal((await request('users', 'PUT', '/profile/3', user)).code, 403);
  assert.equal((await request('users', 'PUT', '/profile/2', user)).passed, true);
  const created = await request('posts', 'POST', '/', user, { user_id: 999 });
  assert.equal(created.body.user_id, 2);
});

test('chat and application actions require resource membership', async () => {
  assert.equal((await request('messages', 'GET', '/5/messages', user)).passed, true);
  assert.equal((await request('messages', 'GET', '/5/messages', { user_id: 3, is_admin: 0 })).code, 403);
  assert.equal((await request('post-applications', 'PATCH', '/1/status', user, { status: 'accepted' })).passed, true);
  assert.equal((await request('post-applications', 'PATCH', '/1/status', { user_id: 3, is_admin: 0 }, { status: 'accepted' })).code, 403);
});
