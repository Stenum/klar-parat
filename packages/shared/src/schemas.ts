import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const timeStringSchema = z
  .string()
  .regex(timePattern, 'Expected HH:MM (24h) time');

export const isoDateStringSchema = z
  .string()
  .regex(datePattern, 'Expected YYYY-MM-DD date');

export const childCreateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  birthdate: isoDateStringSchema,
  active: z.boolean().optional().default(true)
});

export const childUpdateSchema = childCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be provided',
    path: []
  }
);

export const childSchema = childCreateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.string()
});

const templateTaskBaseSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  emoji: z
    .string()
    .trim()
    .max(4, 'Emoji must be at most 4 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  hint: z
    .string()
    .trim()
    .max(140, 'Hint must be 140 characters or fewer')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  expectedMinutes: z
    .number({ coerce: true })
    .nonnegative('Expected minutes must be ≥ 0')
});

export const templateTaskInputSchema = templateTaskBaseSchema.extend({
  id: z.string().cuid().optional()
});

export const templateTaskSchema = templateTaskInputSchema.extend({
  orderIndex: z.number().int().nonnegative()
});

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  defaultStartTime: timeStringSchema,
  defaultEndTime: timeStringSchema,
  tasks: z
    .array(templateTaskBaseSchema)
    .min(1, 'Add at least one task')
    .transform((tasks) =>
      tasks.map((task, index) => ({
        ...task,
        orderIndex: index
      }))
    )
});

export const templateUpdateSchema = templateCreateSchema.extend({
  tasks: z
    .array(templateTaskInputSchema)
    .min(1, 'Add at least one task')
    .transform((tasks) =>
      tasks.map((task, index) => ({
        ...task,
        orderIndex: index
      }))
    )
});

export const templateSchema = templateUpdateSchema.extend({
  id: z.string().cuid(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const templateSnapshotSchema = z.object({
  templateId: z.string().cuid(),
  name: z.string(),
  defaultStartTime: timeStringSchema,
  defaultEndTime: timeStringSchema,
  tasks: z.array(
    templateTaskSchema.pick({
      title: true,
      emoji: true,
      hint: true,
      expectedMinutes: true,
      orderIndex: true
    })
  ),
  expectedTotalMinutes: z.number().nonnegative()
});

export type ChildCreateInput = z.infer<typeof childCreateSchema>;
export type ChildUpdateInput = z.infer<typeof childUpdateSchema>;
export type Child = z.infer<typeof childSchema>;

export type TemplateTaskInput = z.infer<typeof templateTaskInputSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateSnapshot = z.infer<typeof templateSnapshotSchema>;

export type TimeHM = z.infer<typeof timeStringSchema>;
