import {
  computeMedal,
  computeUrgency,
  type SessionActiveTaskTelemetry,
  sessionSchema,
  sessionStartSchema,
  sessionTaskCompleteSchema,
  sessionTelemetrySchema,
  templateSnapshotSchema
} from '@klar-parat/shared';
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
      const sessionStart = new Date();
      const session = await tx.session.create({
        data: {
          childId: child.id,
          templateSnapshot: JSON.stringify(snapshot),
          plannedStartAt: resolvedPlannedStart,
          plannedEndAt: resolvedPlannedEnd,
          expectedTotalMinutes: snapshot.expectedTotalMinutes,
          allowSkip,
          actualStartAt: sessionStart
        }
      });

      await Promise.all(
        snapshot.tasks.map((task) =>
          tx.sessionTask.create({
            data: {
              sessionId: session.id,
              title: task.title,
              expectedMinutes: task.expectedMinutes,
              orderIndex: task.orderIndex,
              startedAt: task.orderIndex === 0 ? sessionStart : null
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

router.get('/:id/telemetry', async (req, res) => {
  const { id } = req.params;
  const now = new Date();

  try {
    const telemetry = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id },
        include: { tasks: true }
      });

      if (!session) {
        return null;
      }

      const snapshot = templateSnapshotSchema.parse(JSON.parse(session.templateSnapshot));
      const snapshotByOrder = new Map(snapshot.tasks.map((task) => [task.orderIndex, task]));
      const completedExpectedMinutes = session.tasks
        .filter((task) => task.completedAt || task.skipped)
        .reduce((total, task) => total + task.expectedMinutes, 0);

      const urgency = computeUrgency({
        plannedStartAt: session.plannedStartAt,
        plannedEndAt: session.plannedEndAt,
        expectedTotalMinutes: session.expectedTotalMinutes,
        completedExpectedMinutes,
        now
      });

      const orderedTasks = session.tasks.slice().sort((a, b) => a.orderIndex - b.orderIndex);
      const activeTask = orderedTasks.find((task) => !task.completedAt && !task.skipped);
      const nextTaskCandidate = orderedTasks.find((task) => {
        if (!activeTask) {
          return !task.completedAt && !task.skipped;
        }
        return task.orderIndex > activeTask.orderIndex && !task.completedAt && !task.skipped;
      });

      const nudges: { sessionTaskId: string; threshold: 'first' | 'second' | 'final'; firedAt: string }[] = [];
      let currentTaskTelemetry: SessionActiveTaskTelemetry | null = null;

      if (activeTask) {
        const startedAt = activeTask.startedAt ?? session.actualStartAt ?? session.plannedStartAt;
        const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
        const totalSeconds = Math.max(1, Math.round(activeTask.expectedMinutes * 60));
        const thresholds = [
          { key: 'nudgeFirstFiredAt' as const, ratio: 1 / 3, label: 'first' as const },
          { key: 'nudgeSecondFiredAt' as const, ratio: 2 / 3, label: 'second' as const },
          { key: 'nudgeFinalFiredAt' as const, ratio: 1, label: 'final' as const }
        ];

        for (const threshold of thresholds) {
          const targetSeconds = Math.max(1, Math.round(totalSeconds * threshold.ratio));
          const alreadyFired = activeTask[threshold.key];

          if (elapsedSeconds >= targetSeconds && !alreadyFired) {
            await tx.sessionTask.update({
              where: { id: activeTask.id },
              data: { [threshold.key]: now }
            });

            activeTask[threshold.key] = now;

            nudges.push({
              sessionTaskId: activeTask.id,
              threshold: threshold.label,
              firedAt: now.toISOString()
            });
          }
        }

        const firedDates = thresholds
          .map((threshold) => activeTask[threshold.key])
          .filter((value): value is Date => Boolean(value));
        const lastNudgeFiredAt = firedDates.length
          ? firedDates.reduce((latest, current) => (current > latest ? current : latest))
          : null;
        const nextNudge = thresholds.find((threshold) => !activeTask[threshold.key]);
        const snapshotTask = snapshotByOrder.get(activeTask.orderIndex);

        currentTaskTelemetry = {
          sessionTaskId: activeTask.id,
          title: activeTask.title,
          expectedMinutes: activeTask.expectedMinutes,
          hint: snapshotTask?.hint,
          startedAt: startedAt.toISOString(),
          elapsedSeconds,
          remainingSeconds: Math.max(0, totalSeconds - elapsedSeconds),
          nudgesFiredCount: firedDates.length,
          totalScheduledNudges: thresholds.length,
          nextNudgeThreshold: nextNudge ? nextNudge.label : null,
          lastNudgeFiredAt: lastNudgeFiredAt ? lastNudgeFiredAt.toISOString() : null
        };
      }

      const nextTaskTelemetry = nextTaskCandidate
        ? {
            title: nextTaskCandidate.title,
            hint: snapshotByOrder.get(nextTaskCandidate.orderIndex)?.hint
          }
        : null;

      return sessionTelemetrySchema.parse({
        urgencyLevel: urgency.urgencyLevel,
        timeRemainingMinutes: urgency.timeRemainingMinutes,
        paceDelta: urgency.paceDelta,
        sessionEndsAt: session.plannedEndAt.toISOString(),
        nudges,
        currentTask: currentTaskTelemetry,
        nextTask: nextTaskTelemetry
      });
    });

    if (!telemetry) {
      return sendNotFound(res, 'Session not found');
    }

    res.json({ telemetry });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.post('/:id/task/:index/complete', async (req, res) => {
  const { id, index } = req.params;
  const orderIndex = Number.parseInt(index, 10);

  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    return sendValidationError(res, [
      {
        code: 'custom',
        message: 'Task index must be a non-negative integer',
        path: ['index']
      }
    ]);
  }

  const parseResult = sessionTaskCompleteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { skipped } = parseResult.data;
  const now = new Date();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id },
        include: { tasks: true }
      });

      if (!session) {
        return null;
      }

      const task = session.tasks.find((item) => item.orderIndex === orderIndex);
      if (!task) {
        return 'TASK_NOT_FOUND';
      }

      const alreadyComplete = !skipped && Boolean(task.completedAt);
      const alreadySkipped = skipped && task.skipped && !task.completedAt;
      if (alreadyComplete || alreadySkipped) {
        return session;
      }

      await tx.sessionTask.update({
        where: { id: task.id },
        data: skipped
          ? {
              skipped: true,
              completedAt: null
            }
          : {
              skipped: false,
              completedAt: now
            }
      });

      if (!skipped && !session.actualStartAt) {
        await tx.session.update({
          where: { id },
          data: { actualStartAt: now }
        });
      }

      const nextTask = await tx.sessionTask.findFirst({
        where: {
          sessionId: session.id,
          orderIndex: { gt: orderIndex },
          completedAt: null,
          skipped: false
        },
        orderBy: { orderIndex: 'asc' }
      });

      if (nextTask && !nextTask.startedAt) {
        await tx.sessionTask.update({
          where: { id: nextTask.id },
          data: { startedAt: now }
        });
      }

      const refreshed = await tx.session.findUnique({
        where: { id },
        include: { tasks: true }
      });

      return refreshed;
    });

    if (updated === null) {
      return sendNotFound(res, 'Session not found');
    }

    if (updated === 'TASK_NOT_FOUND') {
      return sendNotFound(res, 'Task not found');
    }

    res.json({ session: sessionSchema.parse(mapSession(updated)) });
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

router.post('/:id/finish', async (req, res) => {
  const { id } = req.params;
  const now = new Date();

  try {
    const session = await prisma.$transaction(async (tx) => {
      const found = await tx.session.findUnique({
        where: { id },
        include: { tasks: true }
      });

      if (!found) {
        throw new Error('SESSION_NOT_FOUND');
      }

      if (found.actualEndAt && found.medal) {
        return found;
      }

      const hasRemaining = found.tasks.some((task) => !task.completedAt && !task.skipped);
      if (hasRemaining) {
        throw new Error('SESSION_INCOMPLETE');
      }

      const completedTimes = found.tasks
        .map((task) => task.completedAt)
        .filter((value): value is Date => Boolean(value));

      const earliestCompletion = completedTimes.length
        ? completedTimes.reduce((earliest, current) => (current < earliest ? current : earliest))
        : null;

      const effectiveStart = found.actualStartAt ?? earliestCompletion ?? now;

      const medal = computeMedal({
        expectedTotalMinutes: found.expectedTotalMinutes,
        actualDurationMs: now.getTime() - effectiveStart.getTime()
      });

      const updated = await tx.session.update({
        where: { id },
        data: {
          actualStartAt: found.actualStartAt ?? effectiveStart,
          actualEndAt: now,
          medal
        },
        include: { tasks: true }
      });

      return updated;
    });

    res.json({ session: sessionSchema.parse(mapSession(session)) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return sendNotFound(res, 'Session not found');
      }

      if (error.message === 'SESSION_INCOMPLETE') {
        return sendValidationError(res, [
          {
            code: 'custom',
            message: 'All tasks must be completed or skipped before finishing',
            path: ['tasks']
          }
        ]);
      }
    }

    console.error(error);
    sendServerError(res);
  }
});

export const registerSessionRoutes = (app: Express) => {
  app.use('/api/sessions', router);
};
