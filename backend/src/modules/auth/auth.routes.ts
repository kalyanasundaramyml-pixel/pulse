import { Router } from 'express';
import * as controller from './auth.controller';
import { loginSchema, changePasswordSchema } from './auth.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { authRateLimit } from '../../middleware/rateLimit';

export const authRouter = Router();

authRouter.post('/login', authRateLimit, validate(loginSchema), controller.login);
authRouter.post('/logout', requireAuth, controller.logout);
authRouter.get('/me', requireAuth, controller.me);
authRouter.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);
