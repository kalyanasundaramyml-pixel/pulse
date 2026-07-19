import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import { env } from './config/env';
import { SESSION_MAX_AGE_MS } from './config/constants';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { surveysRouter } from './modules/surveys/surveys.routes';
import { responsesRouter } from './modules/responses/responses.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { groupsRouter } from './modules/groups/groups.routes';
import { oneOnOnesRouter } from './modules/oneOnOnes/oneOnOnes.routes';

const PgSession = connectPgSimple(session);
const sessionPool = new Pool({ connectionString: env.DATABASE_URL });

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    session({
      store: new PgSession({ pool: sessionPool, tableName: 'session', createTableIfMissing: true }),
      name: 'sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', usersRouter);
  app.use('/api/surveys', surveysRouter);
  app.use('/api/surveys', responsesRouter);
  app.use('/api/surveys', dashboardRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/one-on-ones', oneOnOnesRouter);

  app.use(errorHandler);

  return app;
}
