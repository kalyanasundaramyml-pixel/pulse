import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { hashPassword, generateTempPassword } from '../../lib/password';
import { ValidationError } from '../../lib/errors';
import { CSV_IMPORT_MAX_ROWS } from '../../config/constants';

const rowSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  email: z.string().trim().toLowerCase().email('invalid email format'),
  role: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : 'USER'))
    .pipe(z.nativeEnum(UserRole)),
});

interface RawRow {
  name?: string;
  email?: string;
  role?: string;
}

interface RowError {
  row: number;
  email?: string;
  message: string;
}

interface ValidRow {
  row: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdUsers: { name: string; email: string; role: UserRole; tempPassword: string }[];
  errors: RowError[];
}

export async function importUsersFromCsv(csvBuffer: Buffer, importedById: string, filename?: string): Promise<ImportResult> {
  let records: RawRow[];
  try {
    records = parse(csvBuffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new ValidationError(`Could not parse CSV file: ${(err as Error).message}`);
  }

  if (records.length === 0) {
    throw new ValidationError('CSV file contains no data rows');
  }
  if (records.length > CSV_IMPORT_MAX_ROWS) {
    throw new ValidationError(`CSV file exceeds the maximum of ${CSV_IMPORT_MAX_ROWS} rows`);
  }

  const validRows: ValidRow[] = [];
  const errors: RowError[] = [];
  const seenEmails = new Set<string>();

  records.forEach((raw, idx) => {
    const rowNumber = idx + 2; // account for header row, 1-indexed
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: rowNumber, email: raw.email, message: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    if (seenEmails.has(parsed.data.email)) {
      errors.push({ row: rowNumber, email: parsed.data.email, message: 'duplicate email within this file' });
      return;
    }
    seenEmails.add(parsed.data.email);
    validRows.push({ row: rowNumber, ...parsed.data });
  });

  // Check against existing users in bulk before the transaction.
  if (validRows.length > 0) {
    const existing = await prisma.user.findMany({
      where: { email: { in: validRows.map((r) => r.email) } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((u) => u.email));
    for (let i = validRows.length - 1; i >= 0; i--) {
      if (existingEmails.has(validRows[i].email)) {
        errors.push({ row: validRows[i].row, email: validRows[i].email, message: 'a user with this email already exists' });
        validRows.splice(i, 1);
      }
    }
  }

  const createdUsers: ImportResult['createdUsers'] = [];

  if (validRows.length > 0) {
    const toInsert = await Promise.all(
      validRows.map(async (row) => {
        const tempPassword = generateTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        return { row, tempPassword, passwordHash };
      }),
    );

    await prisma.$transaction(
      toInsert.map(({ row, passwordHash }) =>
        prisma.user.create({
          data: {
            name: row.name,
            email: row.email,
            role: row.role,
            passwordHash,
            mustChangePassword: true,
          },
        }),
      ),
    );

    for (const { row, tempPassword } of toInsert) {
      createdUsers.push({ name: row.name, email: row.email, role: row.role, tempPassword });
    }
  }

  const batch = await prisma.userImportBatch.create({
    data: {
      importedById,
      filename,
      totalRows: records.length,
      successCount: createdUsers.length,
      errorCount: errors.length,
      rowErrors: {
        create: errors.map((e) => ({ rowNumber: e.row, rawRow: { email: e.email ?? null }, message: e.message })),
      },
    },
  });

  return {
    batchId: batch.id,
    totalRows: records.length,
    successCount: createdUsers.length,
    errorCount: errors.length,
    createdUsers,
    errors,
  };
}
