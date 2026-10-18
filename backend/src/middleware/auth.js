const jwt = require('jsonwebtoken');
const { User } = require('../models');

const INSECURE_DEFAULTS = [
  'padhlo_super_secret_jwt_key_2026',
  'studyhub_production_jwt_secret_2026',
  'secret',
  'changeme',
];

const isProd = process.env.NODE_ENV === 'production';
const envSecret = process.env.JWT_SECRET;

if (isProd) {
  if (!envSecret || INSECURE_DEFAULTS.includes(envSecret) || envSecret.length < 32) {
    console.error('FATAL: Insecure or missing JWT_SECRET in production environment. Aborting startup.');
    process.exit(1);
  }
} else if (!envSecret || INSECURE_DEFAULTS.includes(envSecret)) {
  console.warn('⚠️ SECURITY WARNING: Running with a default/development JWT_SECRET. In production, configure a 32+ char secret in .env.');
}

const JWT_SECRET = envSecret || 'padhlo_dev_jwt_secret_local_only';

// Verify Authenticated User (Accepts Bearer header or query token for stream/downloads)
async function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No session token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, branch, academicYear }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }
}

// Optional Authenticated User (Accepts Bearer header or query token if present, otherwise req.user is null)
async function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, branch, academicYear }
  } catch (err) {
    req.user = null;
  }
  next();
}

// Strict Server-Side Role Guard: Check database or token role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges are required to perform this action.',
    });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, JWT_SECRET };

