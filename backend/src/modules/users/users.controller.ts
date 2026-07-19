import { RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import * as usersService from './users.service';
import { importUsersFromCsv } from './csvImport';
import { ValidationError } from '../../lib/errors';

export const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const { search, role, page, pageSize } = req.query as unknown as {
      search?: string;
      role?: UserRole;
      page: number;
      pageSize: number;
    };
    const result = await usersService.listUsers({ search, role, page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createUser: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, role } = req.body as { name: string; email: string; role: UserRole };
    const { user, tempPassword } = await usersService.createUser({ name, email, role });
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tempPassword,
    });
  } catch (err) {
    next(err);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await usersService.updateUser(
      req.params.id,
      req.body as { role?: UserRole; isActive?: boolean },
      req.user!.id,
    );
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
  } catch (err) {
    next(err);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const result = await usersService.resetPassword(req.params.id, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const importUsers: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No CSV file uploaded (expected field name "file")');
    }
    const result = await importUsersFromCsv(req.file.buffer, req.user!.id, req.file.originalname);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const searchDirectory: RequestHandler = async (req, res, next) => {
  try {
    const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
    const result = await usersService.searchDirectory({ search, page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
