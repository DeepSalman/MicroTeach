async function hasApprovedTutorApplication(conn, userId) {
  const [rows] = await conn.query(
    "SELECT application_id FROM Teacher_Applications WHERE user_id = ? AND status = 'approved' LIMIT 1",
    [userId]
  );
  return rows.length > 0;
}

async function isEligibleTutor(conn, userId, lockUser = false) {
  const [rows] = await conn.query(
    `SELECT role, is_verified FROM Users WHERE user_id = ?${lockUser ? ' FOR UPDATE' : ''}`,
    [userId]
  );
  return rows.length > 0 && ['tutor', 'both'].includes(rows[0].role) &&
    Number(rows[0].is_verified) === 1 &&
    hasApprovedTutorApplication(conn, userId);
}

module.exports = { hasApprovedTutorApplication, isEligibleTutor };
