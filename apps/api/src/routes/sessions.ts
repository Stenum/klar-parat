import { sessionSchema, sessionStartSchema, templateSnapshotSchema } from '@klar-parat/shared';
import type { Express } from 'express';
import { Router } from 'express';

import { sendNotFound, sendServerError, sendValidationError } from '../lib/http.js';
import { mapSession } from '../lib/mappers.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const toPlannedDate = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const result = new Date(now);
  result.setSeconds(0, 0);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

router.post('/start', async (req, res) => {
  const parseResult = sessionStartSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { childId, templateId, plannedStartAt, plannedEndAt, allowSkip } = parseResult.data;

  try {
    const [child, template] = await Promise.all([
      prisma.child.findUnique({ where: { id: childId } }),
      prisma.template.findUnique({ where: { id: templateId }, include: { tasks: true } })
    ]);

    if (!child) {
      return sendNotFound(res, 'Child not found');
    }

    if (!template) {
      return sendNotFound(res, 'Template not found');
    }

    const sortedTasks = template.tasks
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task, index) => ({
        title: task.title,
        emoji: task.emoji ?? undefined,
        hint: task.hint ?? undefined,
        expectedMinutes: task.expectedMinutes,
        orderIndex: index
      }));

    const snapshot = templateSnapshotSchema.parse({
      templateId: template.id,
      name: template.name,
      defaultStartTime: template.defaultStartTime,
      defaultEndTime: template.defaultEndTime,
      tasks: sortedTasks,
      expectedTotalMinutes: sortedTasks.reduce((total, task) => total + task.expectedMinutes, 0)
    });

    const resolvedPlannedStart = plannedStartAt ? new Date(plannedStartAt) : toPlannedDate(snapshot.defaultStartTime);
    const resolvedPlannedEnd = plannedEndAt ? new Date(plannedEndAt) : toPlannedDate(snapshot.defaultEndTime);

    if (resolvedPlannedEnd <= resolvedPlannedStart) {
      return sendValidationError(res, [
        {
          code: 'custom',
          message: 'plannedEndAt must be after plannedStartAt',
          path: ['plannedEndAt']
        }
      ]);
    }

    const created = await prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          childId: child.id,
          templateSnapshot: JSON.stringify(snapshot),
          plannedStartAt: resolvedPlannedStart,
          plannedEndAt: resolvedPlannedEnd,
          expectedTotalMinutes: snapshot.expectedTotalMinutes,
          allowSkip
        }
      });

      await Promise.all(
        snapshot.tasks.map((task) =>
          tx.sessionTask.create({
            data: {
              sessionId: session.id,
              title: task.title,
              expectedMinutes: task.expectedMinutes,
              orderIndex: task.orderIndex
            }
          })
        )
      );

      return tx.session.findUnique({
        where: { id: session.id },
        include: { tasks: true }
      });
    });

    if (!created) {
      return sendServerError(res);
    }

    const session = sessionSchema.parse(mapSession(created));
    res.status(201).json({ session });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: { tasks: true }
    });

    if (!session) {
      return sendNotFound(res, 'Session not found');
    }

    res.json({ session: sessionSchema.parse(mapSession(session)) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

export const registerSessionRoutes = (app: Express) => {
  app.use('/api/sessions', router);
};
