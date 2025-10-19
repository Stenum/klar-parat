import type { Child, Session, Template } from '@klar-parat/shared';
import { templateSnapshotSchema } from '@klar-parat/shared';
import type {
  Child as PrismaChild,
  Session as PrismaSession,
  SessionTask as PrismaSessionTask,
  Template as PrismaTemplate,
  TemplateTask as PrismaTemplateTask
} from '@prisma/client';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const toIsoString = (date: Date) => date.toISOString();

const mapTemplateTask = (task: PrismaTemplateTask) => ({
  id: task.id,
  title: task.title,
  emoji: task.emoji ?? undefined,
  hint: task.hint ?? undefined,
  expectedMinutes: task.expectedMinutes,
  orderIndex: task.orderIndex
});

export const mapChild = (child: PrismaChild): Child => ({
  id: child.id,
  firstName: child.firstName,
  birthdate: toIsoDate(child.birthdate),
  active: child.active,
  createdAt: toIsoString(child.createdAt)
});

export const mapTemplate = (
  template: PrismaTemplate & { tasks: PrismaTemplateTask[] }
): Template => ({
  id: template.id,
  name: template.name,
  defaultStartTime: template.defaultStartTime,
  defaultEndTime: template.defaultEndTime,
  tasks: template.tasks
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(mapTemplateTask),
  createdAt: toIsoString(template.createdAt),
  updatedAt: toIsoString(template.updatedAt)
});

export const mapSession = (
  session: PrismaSession & { tasks: PrismaSessionTask[] }
): Session => {
  const snapshot = templateSnapshotSchema.parse(JSON.parse(session.templateSnapshot));
  const snapshotByOrder = new Map(snapshot.tasks.map((task) => [task.orderIndex, task]));

  return {
    id: session.id,
    childId: session.childId,
    allowSkip: session.allowSkip,
    plannedStartAt: toIsoString(session.plannedStartAt),
    plannedEndAt: toIsoString(session.plannedEndAt),
    actualStartAt: session.actualStartAt ? toIsoString(session.actualStartAt) : null,
    actualEndAt: session.actualEndAt ? toIsoString(session.actualEndAt) : null,
    expectedTotalMinutes: session.expectedTotalMinutes,
    medal: session.medal ?? null,
    templateSnapshot: snapshot,
    tasks: session.tasks
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task) => ({
        id: task.id,
        title: task.title,
        expectedMinutes: task.expectedMinutes,
        completedAt: task.completedAt ? toIsoString(task.completedAt) : null,
        skipped: task.skipped,
        orderIndex: task.orderIndex,
        emoji: snapshotByOrder.get(task.orderIndex)?.emoji,
        hint: snapshotByOrder.get(task.orderIndex)?.hint
      }))
  };
};
