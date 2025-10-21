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

export const medalSchema = z.enum(['gold', 'silver', 'bronze']);

export const sessionTaskSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  expectedMinutes: z.number().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  skipped: z.boolean(),
  orderIndex: z.number().int().nonnegative(),
  emoji: z.string().optional(),
  hint: z.string().optional()
});

export const sessionSchema = z.object({
  id: z.string().cuid(),
  childId: z.string().cuid(),
  allowSkip: z.boolean(),
  plannedStartAt: z.string().datetime(),
  plannedEndAt: z.string().datetime(),
  actualStartAt: z.string().datetime().nullable(),
  actualEndAt: z.string().datetime().nullable(),
  expectedTotalMinutes: z.number().nonnegative(),
  medal: medalSchema.nullable(),
  templateSnapshot: templateSnapshotSchema,
  tasks: z.array(sessionTaskSchema)
});

export const sessionWithChildSchema = z.object({
  session: sessionSchema,
  child: childSchema
});

export const sessionNudgeEventSchema = z.object({
  sessionTaskId: z.string().cuid(),
  threshold: z.enum(['first', 'second', 'final']),
  firedAt: z.string().datetime()
});

export const sessionActiveTaskTelemetrySchema = z.object({
  sessionTaskId: z.string().cuid(),
  title: z.string(),
  expectedMinutes: z.number().nonnegative(),
  hint: z.string().optional(),
  startedAt: z.string().datetime(),
  elapsedSeconds: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  nudgesFiredCount: z.number().int().min(0),
  totalScheduledNudges: z.number().int().min(0),
  nextNudgeThreshold: z.enum(['first', 'second', 'final']).nullable(),
  lastNudgeFiredAt: z.string().datetime().nullable()
});

export const sessionNextTaskTelemetrySchema = z.object({
  title: z.string(),
  hint: z.string().optional()
});

export const sessionTelemetrySchema = z.object({
  urgencyLevel: z.number().int().min(0).max(3),
  timeRemainingMinutes: z.number().int().nonnegative(),
  paceDelta: z.number(),
  sessionEndsAt: z.string().datetime(),
  nudges: z.array(sessionNudgeEventSchema),
  currentTask: sessionActiveTaskTelemetrySchema.nullable().optional(),
  nextTask: sessionNextTaskTelemetrySchema.nullable().optional()
});

export const sessionMessageRequestSchema = z.object({
  type: z.enum(['session_start', 'completion', 'nudge']),
  sessionTaskId: z.string().cuid(),
  language: z
    .string()
    .trim()
    .min(2, 'language code is required')
    .max(10, 'language code must be 10 characters or fewer'),
  nudgeThreshold: z.enum(['first', 'second', 'final']).optional()
});

export const llmResponseSchema = z.object({
  text: z.string().trim().min(1, 'text is required')
});

export const sessionTaskCompleteSchema = z
  .object({
    skipped: z.boolean().optional().default(false)
  })
  .default({ skipped: false });

export const ttsRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'text is required')
    .max(500, 'text must be 500 characters or fewer'),
  language: z
    .string()
    .trim()
    .min(2, 'language code is required')
    .max(10, 'language code must be 10 characters or fewer'),
  voice: z
    .string()
    .trim()
    .min(1, 'voice identifier is required')
    .max(50, 'voice identifier must be 50 characters or fewer')
});

export const sessionStartSchema = z
  .object({
    childId: z.string().cuid(),
    templateId: z.string().cuid(),
    plannedStartAt: z.string().datetime().optional(),
    plannedEndAt: z.string().datetime().optional(),
    allowSkip: z.boolean().optional().default(false)
  })
  .refine(
    ({ plannedStartAt, plannedEndAt }) => {
      if (!plannedStartAt || !plannedEndAt) {
        return true;
      }
      return new Date(plannedEndAt).getTime() > new Date(plannedStartAt).getTime();
    },
    {
      message: 'plannedEndAt must be after plannedStartAt',
      path: ['plannedEndAt']
    }
  );

export type ChildCreateInput = z.infer<typeof childCreateSchema>;
export type ChildUpdateInput = z.infer<typeof childUpdateSchema>;
export type Child = z.infer<typeof childSchema>;

export type TemplateTaskInput = z.infer<typeof templateTaskInputSchema>;
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateSnapshot = z.infer<typeof templateSnapshotSchema>;

export type TimeHM = z.infer<typeof timeStringSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionTask = z.infer<typeof sessionTaskSchema>;
export type SessionStartInput = z.infer<typeof sessionStartSchema>;
export type SessionTaskCompleteInput = z.infer<typeof sessionTaskCompleteSchema>;
export type SessionTelemetry = z.infer<typeof sessionTelemetrySchema>;
export type SessionActiveTaskTelemetry = z.infer<typeof sessionActiveTaskTelemetrySchema>;
export type SessionNextTaskTelemetry = z.infer<typeof sessionNextTaskTelemetrySchema>;
export type SessionMessageRequest = z.infer<typeof sessionMessageRequestSchema>;
export type SessionNudgeEvent = z.infer<typeof sessionNudgeEventSchema>;
export type TtsRequestInput = z.infer<typeof ttsRequestSchema>;
