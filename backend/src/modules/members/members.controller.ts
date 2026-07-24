import { RequestHandler } from 'express';
import { MemberRole } from '@prisma/client';
import * as membersService from './members.service';
import { importMembersFromCsv } from './csvImport';
import { ValidationError } from '../../lib/errors';

export const listMembers: RequestHandler = async (req, res, next) => {
  try {
    const { search, role, groupId, page, pageSize } = req.query as unknown as {
      search?: string;
      role?: MemberRole;
      groupId?: string;
      page: number;
      pageSize: number;
    };
    const result = await membersService.listMembers({ search, role, groupId, page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createMember: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, role, groupId } = req.body as {
      name: string;
      email: string;
      role: MemberRole;
      groupId?: string;
    };
    const { member, tempPassword } = await membersService.createMember({ name, email, role, groupId });
    res.status(201).json({ member, tempPassword });
  } catch (err) {
    next(err);
  }
};

export const updateMember: RequestHandler = async (req, res, next) => {
  try {
    const member = await membersService.updateMember(
      req.params.id,
      req.body as { role?: MemberRole; groupId?: string; isActive?: boolean },
      req.member!.id,
    );
    res.json({ member });
  } catch (err) {
    next(err);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const result = await membersService.resetPassword(req.params.id, req.member!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const importMembers: RequestHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No CSV file uploaded (expected field name "file")');
    }
    const result = await importMembersFromCsv(req.file.buffer, req.member!.id, req.file.originalname);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const searchDirectory: RequestHandler = async (req, res, next) => {
  try {
    const { search, page, pageSize } = req.query as unknown as { search?: string; page: number; pageSize: number };
    const result = await membersService.searchDirectory({ search, page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
};
