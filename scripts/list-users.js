#!/usr/bin/env node
const { db } = require('../server');

const users = db.prepare(`
  SELECT username, display_name, role, active, created_at, updated_at
  FROM users
  ORDER BY username
`).all();

if (!users.length) {
  console.log('No users found. Set DEFAULT_OWNER_* in .env and run npm run setup.');
  process.exit(0);
}

console.table(users.map((user) => ({
  username: user.username,
  displayName: user.display_name,
  role: user.role,
  active: user.active ? 'yes' : 'no',
  createdAt: user.created_at,
  updatedAt: user.updated_at,
})));
