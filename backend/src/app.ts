import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import {
  DuplicateEmailError, Label, PredictionItem, Predictor, PredictorError, Repo, User, isLabel,
} from './types';
import {
  parseId, parsePagination, validateBatch, validateCorrection, validateLogin, validateRegister,
} from './validation';

export interface Deps {
  repo: Repo;
  predictor: Predictor;
  jwtSecret: string;
  corsOrigin: string;
}

const TOKEN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createApp(deps: Deps) {
  const { repo, predictor, jwtSecret } = deps;
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin }));
  app.use(express.json({ limit: '2mb' }));

  const signToken = (user: User) =>
    jwt.sign({ sub: String(user.id), email: user.email }, jwtSecret, { expiresIn: TOKEN_SECONDS });

  // --- auth middleware: sets res.locals.userId ---
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const payload = jwt.verify(token, jwtSecret);
      if (typeof payload === 'object' && typeof payload.sub === 'string') {
        res.locals.userId = Number(payload.sub);
        return next();
      }
    } catch {
      /* fall through to 401 */
    }
    res.status(401).json({ error: 'Authentication required' });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ---------- auth ----------
  app.post('/api/auth/register', async (req, res) => {
    const v = validateRegister(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    try {
      const hash = await bcrypt.hash(v.value.password, 10);
      const user = await repo.createUser(v.value.email, hash, v.value.name);
      return res.status(201).json({ token: signToken(user), user });
    } catch (err) {
      if (err instanceof DuplicateEmailError) return res.status(409).json({ error: 'Email already registered' });
      throw err;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const v = validateLogin(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const found = await repo.findUserByEmail(v.value.email);
    const okPassword = found ? await bcrypt.compare(v.value.password, found.passwordHash) : false;
    if (!found || !okPassword) return res.status(401).json({ error: 'Invalid email or password' });
    const { passwordHash: _ignored, ...user } = found;
    return res.json({ token: signToken(user), user });
  });

  app.get('/api/auth/me', requireAuth, async (_req, res) => {
    const user = await repo.findUserById(res.locals.userId);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    return res.json({ user });
  });

  // ---------- batches ----------
  app.post('/api/batches', requireAuth, async (req, res) => {
    const v = validateBatch(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    let predictions: Awaited<ReturnType<Predictor['predict']>>;
    try {
      predictions = await predictor.predict(v.value.texts);
    } catch (err) {
      if (err instanceof PredictorError) {
        return res.status(502).json({ error: 'Model service unavailable. Please try again later.' });
      }
      throw err;
    }

    const items: PredictionItem[] = v.value.texts.map((text, i) => ({ text, ...predictions[i] }));
    const batchId = await repo.createBatchWithMessages(
      res.locals.userId, v.value.name, predictor.modelVersion, items,
    );
    const batch = await repo.getBatch(res.locals.userId, batchId);
    return res.status(201).json({ batch });
  });

  app.get('/api/batches', requireAuth, async (_req, res) => {
    res.json({ batches: await repo.listBatches(res.locals.userId) });
  });

  app.get('/api/batches/:id', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid batch id' });
    const batch = await repo.getBatch(res.locals.userId, id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    return res.json({ batch });
  });

  app.get('/api/batches/:id/messages', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid batch id' });
    const batch = await repo.getBatch(res.locals.userId, id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const rawLabel = req.query.label;
    let label: Label | undefined;
    if (rawLabel !== undefined) {
      if (!isLabel(rawLabel)) {
        return res.status(400).json({ error: 'label must be negative, neutral or positive' });
      }
      label = rawLabel;
    }
    const { page, pageSize } = parsePagination(req.query);
    const result = await repo.listMessages(res.locals.userId, id, { label, page, pageSize });
    return res.json(result);
  });

  // ---------- human correction ----------
  app.patch('/api/messages/:id', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid message id' });
    const v = validateCorrection(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const updated = await repo.correctMessage(res.locals.userId, id, v.value.label);
    if (!updated) return res.status(404).json({ error: 'Message not found' });
    return res.json({ ok: true });
  });

  // ---------- dashboard numbers ----------
  app.get('/api/stats', requireAuth, async (_req, res) => {
    res.json({ stats: await repo.stats(res.locals.userId) });
  });

  // ---------- errors ----------
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((err as { type?: string })?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    if ((err as { type?: string })?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request too large' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
