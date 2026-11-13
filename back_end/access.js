const db = require('./db');
const { loadSession } = require('./auth');
const { statusChangeAllowed } = require('./applicationStatus');

const same = (a, b) => String(a) === String(b);
const admin = (req) => Number(req.auth?.is_admin) === 1;
const ownerOrAdmin = (req, userId) => admin(req) || same(req.auth.user_id, userId);

async function one(sql, params) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function postOwner(postId) {
  return one('SELECT user_id FROM Posts WHERE post_id = ?', [postId]);
}

async function application(applicationId) {
  return one(
    `SELECT pa.user_id AS applicant_id, pa.status, pa.completion_requested_by,
            p.user_id AS owner_id
       FROM Post_Applications pa JOIN Posts p ON p.post_id = pa.post_id
      WHERE pa.application_id = ?`,
    [applicationId]
  );
}

async function conversationMember(req, conversationId) {
  return Boolean(await one(
    'SELECT user_id FROM Conversation_Members WHERE conversation_id = ? AND user_id = ?',
    [conversationId, req.auth.user_id]
  ));
}

function publicRoute(area, method, path) {
  if (area === 'users' && method === 'POST' && ['/login', '/register', '/logout'].includes(path)) return true;
  if (area === 'users' && method === 'GET' && path === '/username-availability') return true;
  if (area === 'users' && method === 'GET' && /^\/profile\/[^/]+$/.test(path)) return true;
  if (area === 'posts' && method === 'GET' && path === '/') return true;
  if (area === 'skills' && method === 'GET' && path === '/') return true;
  if (area === 'reviews' && method === 'GET' && (/^\/(user|rating)\/[^/]+$/.test(path))) return true;
  if (area === 'post-applications' && method === 'GET' && /^\/post\/[^/]+\/count$/.test(path)) return true;
  return false;
}

async function allowed(area, req, path) {
  const method = req.method;
  const body = req.body || (req.body = {});
  let match;

  if (area === 'users') {
    if (method === 'GET' && path === '/me') return true;
    if (method === 'POST' && path === '/logout') return true;
    if (method === 'GET' && path === '/') return admin(req);
    if (method === 'PUT' && (match = path.match(/^\/profile\/([^/]+)$/))) return ownerOrAdmin(req, match[1]);
    if (method === 'PATCH' && /^\/[^/]+\/(verify|role)$/.test(path)) return admin(req);
    return false;
  }

  if (area === 'posts') {
    if (method === 'GET' && (match = path.match(/^\/user\/([^/]+)$/))) return ownerOrAdmin(req, match[1]);
    if (method === 'POST' && path === '/') {
      body.user_id = req.auth.user_id;
      return true;
    }
    if (method === 'POST' && (match = path.match(/^\/([^/]+)\/close$/))) {
      const post = await postOwner(match[1]);
      if (!post) return false;
      body.user_id = req.auth.user_id;
      return ownerOrAdmin(req, post.user_id);
    }
    if (method === 'DELETE' && /^\/[^/]+$/.test(path)) return admin(req);
    return false;
  }

  if (area === 'skills') return method === 'POST' && path === '/' && admin(req);

  if (area === 'sessions') {
    if (method === 'GET' && path === '/') return admin(req);
    if (method === 'POST' && path === '/') {
      body.student_id = req.auth.user_id;
      return true;
    }
    return false;
  }

  if (area === 'teacher-applications') {
    if (method === 'GET' && path === '/') return admin(req);
    if (method === 'GET' && (match = path.match(/^\/user\/([^/]+)$/))) return ownerOrAdmin(req, match[1]);
    if (method === 'POST' && path === '/') return true;
    if (method === 'PUT' && /^\/[^/]+\/review$/.test(path)) {
      body.reviewed_by = req.auth.user_id;
      return admin(req);
    }
    if (method === 'GET' && /^\/documents\/[^/]+\/file$/.test(path)) return admin(req);
    return false;
  }

  if (area === 'reports') {
    if (method === 'POST' && path === '/') {
      body.user_id = req.auth.user_id;
      return true;
    }
    if (admin(req) && ((method === 'GET' && path === '/') ||
        (method === 'PATCH' && (path === '/batch-status' || /^\/[^/]+\/status$/.test(path))) ||
        (method === 'POST' && /^\/[^/]+\/takedown$/.test(path)))) {
      body.reviewed_by = req.auth.user_id;
      return true;
    }
    return false;
  }

  if (area === 'post-applications') {
    if (method === 'GET' && /^\/post\/[^/]+$/.test(path)) return true;
    if (method === 'GET' && (match = path.match(/^\/user\/([^/]+)$/))) return ownerOrAdmin(req, match[1]);
    if (method === 'POST' && path === '/') {
      body.user_id = req.auth.user_id;
      return true;
    }
    if (method === 'DELETE' && (match = path.match(/^\/([^/]+)$/))) {
      const app = await application(match[1]);
      return app && same(req.auth.user_id, app.applicant_id) &&
        ['pending', 'rejected'].includes(app.status);
    }
    if (method === 'PATCH' && (match = path.match(/^\/([^/]+)\/status$/))) {
      const app = await application(match[1]);
      if (!app || !statusChangeAllowed(app, req.auth.user_id, body.status)) return false;
      body.owner_id = req.auth.user_id;
      if (body.status === 'completion_requested') body.requested_by = req.auth.user_id;
      return true;
    }
    return false;
  }

  if (area === 'messages') {
    if (method === 'POST' && path === '/start') {
      body.user_id = req.auth.user_id;
      return true;
    }
    if (method === 'GET' && (match = path.match(/^\/(inbox|unread)\/([^/]+)$/))) return same(req.auth.user_id, match[2]);
    if ((method === 'GET' && (match = path.match(/^\/([^/]+)\/messages$/))) ||
        (method === 'POST' && (match = path.match(/^\/([^/]+)\/messages$/))) ||
        (method === 'PATCH' && (match = path.match(/^\/([^/]+)\/read$/))) ||
        (method === 'GET' && (match = path.match(/^\/([^/]+)\/[^/]+\/file$/)))) {
      if (method === 'PATCH') body.user_id = req.auth.user_id;
      return conversationMember(req, match[1]);
    }
    return false;
  }

  if (area === 'wallet') {
    if (method === 'GET' && (match = path.match(/^\/(balance|transactions)\/([^/]+)$/))) return ownerOrAdmin(req, match[2]);
    return false;
  }

  if (area === 'reviews') {
    if (method === 'GET' && (match = path.match(/^\/check\/[^/]+\/([^/]+)$/))) return same(req.auth.user_id, match[1]);
    if (method === 'POST' && path === '/') {
      body.reviewer_id = req.auth.user_id;
      if (!body.post_id || !body.reviewee_id) return false;
      const match = await one(
        `SELECT p.user_id AS owner_id, pa.user_id AS tutor_id
           FROM Post_Applications pa JOIN Posts p ON p.post_id = pa.post_id
          WHERE pa.post_id = ? AND pa.status = 'completed'
            AND (p.user_id = ? OR pa.user_id = ?)
          LIMIT 1`,
        [body.post_id, req.auth.user_id, req.auth.user_id]
      );
      return match && (
        (same(req.auth.user_id, match.owner_id) && same(body.reviewee_id, match.tutor_id)) ||
        (same(req.auth.user_id, match.tutor_id) && same(body.reviewee_id, match.owner_id))
      );
    }
    return false;
  }

  if (area === 'transaction-disputes') {
    if (method === 'GET' && path === '/') return admin(req);
    if (method === 'GET' && (match = path.match(/^\/check\/[^/]+\/([^/]+)$/))) return ownerOrAdmin(req, match[1]);
    if (method === 'POST' && path === '/') {
      body.reporter_id = req.auth.user_id;
      if (!body.post_id) return false;
      return Boolean(await one(
        `SELECT p.post_id FROM Posts p
           LEFT JOIN Post_Applications pa ON pa.post_id = p.post_id
          WHERE p.post_id = ? AND (p.user_id = ? OR pa.user_id = ?)
          LIMIT 1`,
        [body.post_id, req.auth.user_id, req.auth.user_id]
      ));
    }
    if (admin(req) && ((method === 'POST' && /^\/[^/]+\/resolve$/.test(path)) ||
        (method === 'PATCH' && /^\/[^/]+\/status$/.test(path)))) {
      body.admin_id = req.auth.user_id;
      return true;
    }
    return false;
  }

  if (area === 'master-data') {
    if (!admin(req)) return false;
    if (method === 'POST' && path === '/adjust-balance') body.admin_id = req.auth.user_id;
    return true;
  }

  return false;
}

function access(area) {
  return async (req, res, next) => {
    const path = req.path.replace(/\/+$/, '') || '/';
    try {
      if (publicRoute(area, req.method, path)) {
        if (area === 'users' && req.method === 'GET' && /^\/profile\/[^/]+$/.test(path)) {
          req.auth = await loadSession(req);
          res.setHeader('Cache-Control', 'no-store');
        }
        return next();
      }
      req.auth = await loadSession(req);
      if (!req.auth) return res.status(401).json({ message: 'Please sign in.' });
      res.setHeader('Cache-Control', 'no-store');
      if (!(await allowed(area, req, path))) {
        return res.status(403).json({ message: 'You do not have access to this resource.' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = access;
