import { childCreateSchema, childUpdateSchema } from '@klar-parat/shared';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import { Router } from 'express';

import { sendNotFound, sendServerError, sendValidationError } from '../lib/http.js';
import { mapChild } from '../lib/mappers.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const children = await prisma.child.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json({ children: children.map(mapChild) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.post('/', async (req, res) => {
  const parseResult = childCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { firstName, birthdate, active } = parseResult.data;
  try {
    const created = await prisma.child.create({
      data: {
        firstName,
        birthdate: new Date(`${birthdate}T00:00:00.000Z`),
        active
      }
    });
    res.status(201).json({ child: mapChild(created) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.put('/:id', async (req, res) => {
  const parseResult = childUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { id } = req.params;
  try {
    const updated = await prisma.child.update({
      where: { id },
      data: {
        ...(parseResult.data.firstName && { firstName: parseResult.data.firstName }),
        ...(parseResult.data.birthdate && {
          birthdate: new Date(`${parseResult.data.birthdate}T00:00:00.000Z`)
        }),
        ...(parseResult.data.active !== undefined && { active: parseResult.data.active })
      }
    });
    res.json({ child: mapChild(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return sendNotFound(res, 'Child not found');
    }
    console.error(error);
    sendServerError(res);
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.child.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return sendNotFound(res, 'Child not found');
    }
    console.error(error);
    sendServerError(res);
  }
});

export const registerChildrenRoutes = (app: Express) => {
  app.use('/api/children', router);
};
