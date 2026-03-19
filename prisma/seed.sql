-- Seed admin user for Kind E2E tests
-- Password: adminpass123 (bcrypt hash with 10 rounds)
INSERT OR IGNORE INTO User (id, username, passwordHash, displayName)
VALUES (
  'seed-admin-001',
  'admin',
  '$2b$10$mH3ln54bjUEP.RzPZSUqeevObHNCbiIIes1QjBcq0p3LPZ6qIEBJC',
  'Admin User'
);
