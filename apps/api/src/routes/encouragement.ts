import {
  computeUrgency,
  llmResponseSchema,
  sessionMessageRequestSchema,
  templateSnapshotSchema
} from '@klar-parat/shared';
import type { Express } from 'express';
import { Router } from 'express';
import OpenAI from 'openai';

import { loadFeatureFlags } from '../config/flags.js';
import { sendNotFound, sendServerError, sendValidationError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const MAX_MESSAGE_LENGTH = 120;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeLanguage = (code: string) => {
  if (code.toLowerCase().startsWith('da')) {
    return 'Danish';
  }
  return 'English';
};

const truncateText = (text: string) => {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`;
};

const formatNudgeThreshold = (threshold: 'first' | 'second' | 'final' | null) => {
  switch (threshold) {
    case 'first':
      return 'first gentle check-in (33% of expected time)';
    case 'second':
      return 'second energising nudge (66% of expected time)';
    case 'final':
      return 'final urgent-but-kind reminder (100% of expected time)';
    default:
      return 'all planned nudges already sent';
  }
};

const toAgeYears = (birthdate: Date, now: Date) => {
  const diffMs = now.getTime() - birthdate.getTime();
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor(diffMs / yearMs));
};

const buildFallbackMessage = ({
  type,
  childFirstName,
  taskTitle,
  nextTaskTitle,
  language
}: {
  type: 'completion' | 'nudge';
  childFirstName: string;
  taskTitle: string;
  nextTaskTitle: string | null;
  language: string;
}) => {
  const isDanish = language.toLowerCase().startsWith('da');

  if (type === 'completion') {
    if (isDanish) {
      return truncateText(
        nextTaskTitle
          ? `Sejt, ${childFirstName}! Videre til ${nextTaskTitle}!`
          : `Fantastisk arbejde, ${childFirstName}!`
      );
    }

    return truncateText(
      nextTaskTitle
        ? `Amazing job, ${childFirstName}! Next up: ${nextTaskTitle}!`
        : `Awesome work finishing ${taskTitle}, ${childFirstName}!`
    );
  }

  if (isDanish) {
    return truncateText(`Hey ${childFirstName}, hold fokus på ${taskTitle}!`);
  }

  return truncateText(`You’ve got this, ${childFirstName}! Stay on ${taskTitle}!`);
};

const buildFakeMessage = ({
  type,
  childFirstName,
  taskTitle,
  nextTaskTitle,
  sessionMinutesRemaining,
  currentTaskSecondsRemaining,
  language
}: {
  type: 'completion' | 'nudge';
  childFirstName: string;
  taskTitle: string;
  nextTaskTitle: string | null;
  sessionMinutesRemaining: number;
  currentTaskSecondsRemaining: number;
  language: string;
}) => {
  const isDanish = language.toLowerCase().startsWith('da');
  const minutesText = sessionMinutesRemaining > 0 ? `${sessionMinutesRemaining}m` : 'lige nu';
  const secondsText = currentTaskSecondsRemaining > 30 ? 'stadig tid' : 'næsten færdig';
  const englishMinutes = sessionMinutesRemaining > 0 ? `${sessionMinutesRemaining}m` : 'right now';
  const englishSeconds = currentTaskSecondsRemaining > 30 ? 'plenty of time' : 'almost done';

  if (type === 'completion') {
    if (isDanish) {
      return truncateText(
        nextTaskTitle
          ? `Super, ${childFirstName}! ${minutesText} tilbage — nu ${nextTaskTitle}!`
          : `Flot klaret, ${childFirstName}! Du kører!`
      );
    }

    return truncateText(
      nextTaskTitle
        ? `Great job, ${childFirstName}! ${englishMinutes} left — next is ${nextTaskTitle}!`
        : `Way to go finishing ${taskTitle}, ${childFirstName}!`
    );
  }

  if (isDanish) {
    return truncateText(`Kom så, ${childFirstName}! ${secondsText} på ${taskTitle}!`);
  }

  return truncateText(`Let’s go, ${childFirstName}! You’re ${englishSeconds} on ${taskTitle}!`);
};

const SYSTEM_PROMPT = `You are Klar Parat’s upbeat morning coach speaking to young kids. Keep every message under 120 characters, energetic, and shame-free.
Always address the child by first name, celebrate wins, and gently mention time remaining.
Nudging strategy: each task allows up to three check-ins — first gentle, second energising, final urgent but kind.
Return strict JSON: {"text":"..."} with no extra keys or prose.`;

let openAiClient: OpenAI | null = null;

const getOpenAiClient = () => {
  if (!openAiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openAiClient = new OpenAI({ apiKey });
  }

  return openAiClient;
};

const callOpenAi = async ({
  context,
  language
}: {
  context: Record<string, unknown>;
  language: string;
}): Promise<string | null> => {
  const client = getOpenAiClient();
  const userPrompt = `Language: ${describeLanguage(language)}.\nContext:\n${JSON.stringify(context, null, 2)}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      });

      const choice = response.choices?.[0]?.message?.content;
      if (!choice) {
        return null;
      }

      try {
        const parsed = JSON.parse(choice);
        const validated = llmResponseSchema.parse(parsed);
        return truncateText(validated.text);
      } catch (error) {
        console.error('Failed to parse LLM response', error);
        return null;
      }
    } catch (error) {
      console.error('OpenAI request failed', error);
      if (attempt === 0) {
        await wait(150 + Math.random() * 150);
      }
    }
  }

  return null;
};

router.post('/api/sessions/:id/message', async (req, res) => {
  const { id } = req.params;
  const parseResult = sessionMessageRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const { type, sessionTaskId, nudgeThreshold, language } = parseResult.data;
  const now = new Date();

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: { tasks: true, child: true }
    });

    if (!session) {
      return sendNotFound(res, 'Session not found');
    }

    const task = session.tasks.find((item) => item.id === sessionTaskId);
    if (!task) {
      return sendNotFound(res, 'Task not found in this session');
    }

    const snapshot = templateSnapshotSchema.parse(JSON.parse(session.templateSnapshot));
    const snapshotByOrder = new Map(snapshot.tasks.map((item) => [item.orderIndex, item]));
    const completedExpectedMinutes = session.tasks
      .filter((item) => item.completedAt || item.skipped)
      .reduce((total, item) => total + item.expectedMinutes, 0);
    const urgency = computeUrgency({
      plannedStartAt: session.plannedStartAt,
      plannedEndAt: session.plannedEndAt,
      expectedTotalMinutes: session.expectedTotalMinutes,
      completedExpectedMinutes,
      now
    });

    const thresholds = [
      { key: 'nudgeFirstFiredAt' as const, label: 'first' as const },
      { key: 'nudgeSecondFiredAt' as const, label: 'second' as const },
      { key: 'nudgeFinalFiredAt' as const, label: 'final' as const }
    ];

    const startedAt = task.startedAt ?? session.actualStartAt ?? session.plannedStartAt;
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
    const totalSeconds = Math.max(1, Math.round(task.expectedMinutes * 60));
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    const firedDates = thresholds
      .map((threshold) => task[threshold.key])
      .filter((value): value is Date => Boolean(value));
    const nextThreshold = thresholds.find((threshold) => !task[threshold.key]);

    const nextTaskCandidate = session.tasks
      .filter((item) => item.orderIndex > task.orderIndex && !item.completedAt && !item.skipped)
      .sort((a, b) => a.orderIndex - b.orderIndex)[0];

    const context = {
      eventType: type,
      child: {
        firstName: session.child.firstName,
        ageYears: toAgeYears(session.child.birthdate, now)
      },
      session: {
        urgencyLevel: urgency.urgencyLevel,
        timeRemainingMinutes: urgency.timeRemainingMinutes,
        timeRemainingSeconds: Math.max(0, Math.round((session.plannedEndAt.getTime() - now.getTime()) / 1000)),
        endsAt: session.plannedEndAt.toISOString()
      },
      task: {
        title: task.title,
        hint: snapshotByOrder.get(task.orderIndex)?.hint ?? null,
        expectedMinutes: task.expectedMinutes,
        elapsedSeconds,
        remainingSeconds,
        nudgesFiredCount: firedDates.length,
        totalScheduledNudges: thresholds.length,
        upcomingNudge: formatNudgeThreshold(type === 'nudge' ? nudgeThreshold ?? nextThreshold?.label ?? null : null),
        celebrationCue:
          type === 'completion'
            ? `Cheer ${session.child.firstName} for finishing ${task.title}.`
            : null,
        nextTask: nextTaskCandidate
          ? {
              title: nextTaskCandidate.title,
              hint: snapshotByOrder.get(nextTaskCandidate.orderIndex)?.hint ?? null
            }
          : null
      }
    } satisfies Record<string, unknown>;

    const flags = loadFeatureFlags();
    let text: string | null = null;

    if (flags.useFakeLLM) {
      text = buildFakeMessage({
        type,
        childFirstName: session.child.firstName,
        taskTitle: task.title,
        nextTaskTitle: context.task.nextTask?.title ?? null,
        sessionMinutesRemaining: urgency.timeRemainingMinutes,
        currentTaskSecondsRemaining: remainingSeconds,
        language
      });
    } else {
      try {
        text = await callOpenAi({ context, language });
      } catch (error) {
        console.error('LLM client unavailable', error);
        text = null;
      }
    }

    if (!text) {
      text = buildFallbackMessage({
        type,
        childFirstName: session.child.firstName,
        taskTitle: task.title,
        nextTaskTitle: context.task.nextTask?.title ?? null,
        language
      });
    }

    const payload = llmResponseSchema.parse({ text });
    res.json(payload);
  } catch (error) {
    console.error(error);
    sendServerError(res);
  }
});

export const registerEncouragementRoutes = (app: Express) => {
  app.use(router);
};
