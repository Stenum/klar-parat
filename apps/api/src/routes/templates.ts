import {
  templateCreateSchema,
  templateSnapshotSchema,
  templateUpdateSchema
} from '@klar-parat/shared';
import { Prisma } from '@prisma/client';
import type { Express } from 'express';
import { Router } from 'express';

import { sendNotFound, sendServerError, sendValidationError } from '../lib/http.js';
import { mapTemplate } from '../lib/mappers.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const templates = await prisma.template.findMany({
      include: { tasks: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ templates: templates.map(mapTemplate) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.post('/', async (req, res) => {
  const parseResult = templateCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { name, defaultStartTime, defaultEndTime, tasks } = parseResult.data;
  try {
    const created = await prisma.template.create({
      data: {
        name,
        defaultStartTime,
        defaultEndTime,
        tasks: {
          create: tasks.map(({ title, emoji, hint, expectedMinutes, orderIndex }) => ({
            title,
            emoji,
            hint,
            expectedMinutes,
            orderIndex
          }))
        }
      },
      include: { tasks: true }
    });

    res.status(201).json({ template: mapTemplate(created) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.put('/:id', async (req, res) => {
  const parseResult = templateUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { id } = req.params;
  try {
    const { name, defaultStartTime, defaultEndTime, tasks } = parseResult.data;

    const updated = await prisma.template.update({
      where: { id },
      data: {
        name,
        defaultStartTime,
        defaultEndTime,
        tasks: {
          deleteMany: {},
          create: tasks.map(({ title, emoji, hint, expectedMinutes, orderIndex }) => ({
            title,
            emoji,
            hint,
            expectedMinutes,
            orderIndex
          }))
        }
      },
      include: { tasks: true }
    });

    res.json({ template: mapTemplate(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return sendNotFound(res, 'Template not found');
    }
    console.error(error);
    sendServerError(res);
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.template.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return sendNotFound(res, 'Template not found');
    }
    console.error(error);
    sendServerError(res);
  }
});

router.post('/:id/clone-to-today', async (req, res) => {
  const { id } = req.params;
  try {
    const template = await prisma.template.findUnique({
      where: { id },
      include: { tasks: true }
    });

    if (!template) {
      return sendNotFound(res, 'Template not found');
    }

    const sortedTasks = template.tasks
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task) => ({
        title: task.title,
        emoji: task.emoji ?? undefined,
        hint: task.hint ?? undefined,
        expectedMinutes: task.expectedMinutes,
        orderIndex: task.orderIndex
      }));

    const snapshot = {
      templateId: template.id,
      name: template.name,
      defaultStartTime: template.defaultStartTime,
      defaultEndTime: template.defaultEndTime,
      tasks: sortedTasks,
      expectedTotalMinutes: sortedTasks.reduce((total, task) => total + task.expectedMinutes, 0)
    };

    const validatedSnapshot = templateSnapshotSchema.parse(snapshot);

    res.json({ snapshot: validatedSnapshot });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

export const registerTemplateRoutes = (app: Express) => {
  app.use('/api/templates', router);
};
