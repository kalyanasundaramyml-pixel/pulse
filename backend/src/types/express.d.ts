import 'express-session';
import { Member } from '@prisma/client';

declare module 'express-session' {
  interface SessionData {
    memberId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      member?: Member;
    }
  }
}

export {};
