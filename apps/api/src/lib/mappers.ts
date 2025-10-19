import { type Child, type Template } from '@klar-parat/shared';
import type { Child as PrismaChild, Template as PrismaTemplate, TemplateTask as PrismaTemplateTask } from '@prisma/client';

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
