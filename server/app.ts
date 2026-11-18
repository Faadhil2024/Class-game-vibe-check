import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { getVibeStore } from './store.ts';
import { isProductionDeployment, isSupabaseConfigured } from './supabase.ts';
import type { AnswerChoice } from '../src/shared/questions.ts';

function getTaPasscode(): string {
  const configured = process.env.TA_PASSCODE?.trim();
  if (configured) return configured;
  if (isProductionDeployment()) {
    throw new Error('TA_PASSCODE environment variable is required in production.');
  }
  return 'vibe-ta-2026';
}

let cachedDevAuthSecret: string | null = null;

function getAuthSecret(): string {
  const envSecret = process.env.TA_AUTH_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  // In serverless production (Vercel), derive a deterministic HMAC key across cold starts
  // from server-side secrets without ever writing to the read-only filesystem.
  if (isProductionDeployment() || isSupabaseConfigured()) {
    const seed = `${process.env.SUPABASE_SECRET_KEY || ''}:${process.env.TA_PASSCODE || ''}`;
    if (!seed || seed === ':') {
      throw new Error('TA_AUTH_SECRET environment variable is required.');
    }
    return crypto
      .createHmac('sha256', 'vibe-check-ta-session-secret-v1')
      .update(seed)
      .digest('hex');
  }

  if (cachedDevAuthSecret) return cachedDevAuthSecret;

  const dataDir = path.resolve(process.cwd(), 'data');
  const secretPath = path.join(dataDir, 'ta-secret.key');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) {
      cachedDevAuthSecret = existing;
      return existing;
    }
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, generated, 'utf8');
  cachedDevAuthSecret = generated;
  return generated;
}

function signTaToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'ta',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTaToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  let expectedSig: string;
  try {
    expectedSig = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  } catch {
    return false;
  }

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'ta' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function extractTaToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return undefined;
}

function requireTaAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractTaToken(req);
  if (!verifyTaToken(token)) {
    res.status(401).json({ error: 'TA authentication required.' });
    return;
  }
  next();
}

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 12;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}

export function createApiApp(): Express {
  const app = express();

  // In Vercel serverless Node functions, req.body may already be parsed by the runtime.
  // Skip express.json() when req.body is already populated so the request stream never hangs.
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
      next();
      return;
    }
    express.json({ limit: '64kb' })(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
      hasTaPasscode: Boolean(process.env.TA_PASSCODE),
    });
  });

  app.get('/api/session/active', async (_req, res) => {
    try {
      const store = getVibeStore();
      const session = await store.getActiveSessionPublic();
      res.json({ session });
    } catch (err) {
      console.error('Error fetching active session:', err);
      res.status(500).json({ error: 'Unable to load active classroom session.' });
    }
  });

  app.post('/api/students/join', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        name?: unknown;
        deviceId?: unknown;
        joinCode?: unknown;
        existingToken?: unknown;
      };

      if (typeof body.name !== 'string' || typeof body.deviceId !== 'string') {
        res.status(400).json({ error: 'Name and browser identifier are required.' });
        return;
      }

      const store = getVibeStore();
      const result = await store.joinStudent({
        name: body.name,
        deviceId: body.deviceId,
        joinCode: typeof body.joinCode === 'string' ? body.joinCode : undefined,
        existingToken: typeof body.existingToken === 'string' ? body.existingToken : undefined,
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error, code: result.code });
        return;
      }

      res.json({
        student: result.student,
        studentToken: result.studentToken,
        resumed: result.resumed,
      });
    } catch (err) {
      console.error('Error joining student:', err);
      res.status(500).json({ error: 'Could not join the classroom poll. Please try again.' });
    }
  });

  app.get('/api/students/me', async (req, res) => {
    try {
      const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
      const studentToken = req.headers['x-student-token'];
      if (!studentId || typeof studentToken !== 'string') {
        res.status(401).json({ error: 'Missing student session credentials.' });
        return;
      }

      const store = getVibeStore();
      const student = await store.getStudentSelf(studentId, studentToken);
      if (!student) {
        res.status(404).json({ error: 'Active student session not found.' });
        return;
      }
      const session = await store.getActiveSessionPublic();
      res.json({ student, session });
    } catch (err) {
      console.error('Error restoring student session:', err);
      res.status(500).json({ error: 'Unable to restore your poll progress.' });
    }
  });

  app.patch('/api/students/:id/answer', async (req, res) => {
    try {
      const studentId = String(req.params.id);
      const studentToken = req.headers['x-student-token'];
      if (typeof studentToken !== 'string') {
        res.status(401).json({ error: 'Missing student session token.' });
        return;
      }

      const body = (req.body ?? {}) as { questionId?: unknown; choice?: unknown };
      if (typeof body.questionId !== 'string' || (body.choice !== 'A' && body.choice !== 'B')) {
        res.status(400).json({ error: 'Valid questionId and choice (A or B) are required.' });
        return;
      }

      const store = getVibeStore();
      const result = await store.saveAnswer({
        studentId,
        studentToken,
        questionId: body.questionId,
        choice: body.choice as AnswerChoice,
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ student: result.student });
    } catch (err) {
      console.error('Error saving student answer:', err);
      res.status(500).json({ error: 'Could not save your answer. Please try selecting again.' });
    }
  });

  app.post('/api/students/:id/complete', async (req, res) => {
    try {
      const studentId = String(req.params.id);
      const studentToken = req.headers['x-student-token'];
      if (typeof studentToken !== 'string') {
        res.status(401).json({ error: 'Missing student session token.' });
        return;
      }

      const store = getVibeStore();
      const result = await store.completeStudent({
        studentId,
        studentToken,
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ student: result.student });
    } catch (err) {
      console.error('Error completing student poll:', err);
      res.status(500).json({ error: 'Could not lock in your answers. Please try again.' });
    }
  });

  app.get('/api/results/live', async (_req, res) => {
    try {
      const store = getVibeStore();
      const results = await store.getPublicLiveResults();
      res.setHeader('Cache-Control', 'no-store');
      res.json(results);
    } catch (err) {
      console.error('Error loading live results:', err);
      res.status(500).json({ error: 'Unable to load live class results.' });
    }
  });

  app.post('/api/ta/login', (req, res) => {
    try {
      const ip = getClientIp(req);
      if (isLoginRateLimited(ip)) {
        res.status(429).json({ error: 'Too many failed passcode attempts. Please wait a few minutes.' });
        return;
      }

      const body = (req.body ?? {}) as { passcode?: unknown };
      if (typeof body.passcode !== 'string') {
        res.status(400).json({ error: 'Passcode is required.' });
        return;
      }

      const expectedPasscode = getTaPasscode();
      const providedBuf = Buffer.from(body.passcode.trim());
      const expectedBuf = Buffer.from(expectedPasscode);
      const match =
        providedBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(providedBuf, expectedBuf);

      if (!match) {
        recordFailedLogin(ip);
        res.status(401).json({ error: 'Incorrect TA passcode.' });
        return;
      }

      clearFailedLogins(ip);
      const token = signTaToken();
      res.json({ token });
    } catch (err) {
      console.error('Error during TA login:', err);
      res.status(500).json({ error: 'TA authentication configuration error on server.' });
    }
  });

  app.get('/api/ta/verify', requireTaAuth, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.get('/api/ta/overview', requireTaAuth, async (_req, res) => {
    try {
      const store = getVibeStore();
      const payload = await store.getTaDashboardPayload();
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (err) {
      console.error('Error loading TA overview:', err);
      res.status(500).json({ error: 'Unable to load TA dashboard data.' });
    }
  });

  app.get('/api/ta/students/:id', requireTaAuth, async (req, res) => {
    try {
      const store = getVibeStore();
      const student = await store.getTaStudentById(String(req.params.id));
      if (!student) {
        res.status(404).json({ error: 'Student not found in active session.' });
        return;
      }
      res.json({ student });
    } catch (err) {
      console.error('Error loading TA student record:', err);
      res.status(500).json({ error: 'Unable to load student responses.' });
    }
  });

  app.get('/api/ta/export.csv', requireTaAuth, async (_req, res) => {
    try {
      const store = getVibeStore();
      const [csv, session] = await Promise.all([
        store.buildCsvExport(),
        store.getActiveSessionPublic(),
      ]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="class-vibe-check-${session.joinCode.toLowerCase()}.csv"`
      );
      res.send(csv);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      res.status(500).json({ error: 'Could not generate CSV export.' });
    }
  });

  app.post('/api/ta/session/new', requireTaAuth, async (req, res) => {
    try {
      const body = (req.body ?? {}) as { label?: unknown };
      const label = typeof body.label === 'string' ? body.label : undefined;
      const store = getVibeStore();
      const session = await store.startNewSession(label);
      res.json({ session });
    } catch (err) {
      console.error('Error starting new session:', err);
      res.status(500).json({ error: 'Failed to start new classroom session.' });
    }
  });

  app.post('/api/ta/session/reset', requireTaAuth, async (_req, res) => {
    try {
      const store = getVibeStore();
      const session = await store.resetCurrentSession();
      res.json({ session });
    } catch (err) {
      console.error('Error resetting session:', err);
      res.status(500).json({ error: 'Failed to reset classroom session.' });
    }
  });

  return app;
}
