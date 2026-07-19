import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { BCRYPT_COST_FACTOR, TEMP_PASSWORD_LENGTH } from '../config/constants';

// Excludes visually ambiguous characters: 0/O, 1/l/I
const TEMP_PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_CHARSET[bytes[i] % TEMP_PASSWORD_CHARSET.length];
  }
  return result;
}
