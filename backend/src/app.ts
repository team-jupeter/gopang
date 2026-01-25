/**
 * Express 서버
 * Day 16: Vault 라우트 추가
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

import { apiLimiter, authLimiter } from './middlewares/rateLimiter';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import vaultRouter from './routes/vault';

const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

app.use(helmet());
app.use(cors());
app.use(compression());

morgan.token('request-id', (req: Request) => req.headers['x-request-id'] as string);
app.use(morgan(':request-id :method :url :status :response-time ms'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/vault', vaultRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error] ${req.headers['x-request-id']}:`, err.message);
  res.status(500).json({ error: 'Internal Server Error', requestId: req.headers['x-request-id'] });
});

export default app;
