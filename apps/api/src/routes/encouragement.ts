import {
  computeUrgency,
  llmResponseSchema,
  sessionMessageRequestSchema,
  templateSnapshotSchema
} from '@klar-parat/shared';
import type { Express } from 'express';
import { Router } from 'express';
import { loadFeatureFlags } from '../config/flags.js';
import { sendNotFound, sendServerError, sendValidationError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

type OpenAIClient = {
  chat: {
    completions: {
      create(input: {
        model: string;
        temperature: number;
        max_tokens: number;
        messages: { role: string; content: string }[];
      }): Promise<{
        choices?: { message?: { content?: string } }[];
      }>;
    };
  };
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeLanguage = (code: string) => {
  if (code.toLowerCase().startsWith('da')) {
    return 'Danish';
  }
  return 'English';
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
  sessionName,
  taskTitle,
  nextTaskTitle,
  sessionMinutesRemaining,
  language
}: {
  type: 'session_start' | 'completion' | 'nudge';
  childFirstName: string;
  sessionName: string;
  taskTitle: string;
  nextTaskTitle: string | null;
  sessionMinutesRemaining: number;
  language: string;
}) => {
  const isDanish = language.toLowerCase().startsWith('da');
  const timePhrase = (() => {
    if (sessionMinutesRemaining <= 0) {
      return isDanish ? 'Tiden er knap' : 'Time is almost up';
    }
    return isDanish
      ? `Vi har cirka ${sessionMinutesRemaining} min`
      : `We have about ${sessionMinutesRemaining} minutes`;
  })();

  if (type === 'session_start') {
    if (isDanish) {
      return `${timePhrase}, ${childFirstName}! Første opgave er ${taskTitle} i ${sessionName}.`;
    }
    return `${timePhrase}, ${childFirstName}! First up for ${sessionName} is ${taskTitle}.`;
  }

  if (type === 'completion') {
    if (isDanish) {
      return nextTaskTitle
        ? `Sejt, ${childFirstName}! ${timePhrase.toLowerCase()} — videre til ${nextTaskTitle}!`
        : `Fantastisk arbejde, ${childFirstName}! ${timePhrase.toLowerCase()} til resten.`;
    }

    return nextTaskTitle
      ? `Amazing job, ${childFirstName}! ${timePhrase.toLowerCase()} — next up is ${nextTaskTitle}.`
      : `Awesome work finishing ${taskTitle}, ${childFirstName}! ${timePhrase.toLowerCase()} to spare.`;
  }

  if (isDanish) {
    return `${timePhrase}, ${childFirstName}! Hold fokus på ${taskTitle}.`;
  }

  return `${timePhrase}, ${childFirstName}! Stay on ${taskTitle}!`;
};

const buildFakeMessage = ({
  type,
  childFirstName,
  sessionName,
  taskTitle,
  nextTaskTitle,
  sessionMinutesRemaining,
  sessionMinutesElapsed,
  currentTaskSecondsRemaining,
  language
}: {
  type: 'session_start' | 'completion' | 'nudge';
  childFirstName: string;
  sessionName: string;
  taskTitle: string;
  nextTaskTitle: string | null;
  sessionMinutesRemaining: number;
  sessionMinutesElapsed: number;
  currentTaskSecondsRemaining: number;
  language: string;
}) => {
  const isDanish = language.toLowerCase().startsWith('da');
  const minutesText = sessionMinutesRemaining > 0 ? `${sessionMinutesRemaining}m` : 'lige nu';
  const secondsText = currentTaskSecondsRemaining > 30 ? 'stadig tid' : 'næsten færdig';
  const englishMinutes = sessionMinutesRemaining > 0 ? `${sessionMinutesRemaining}m` : 'right now';
  const englishSeconds = currentTaskSecondsRemaining > 30 ? 'plenty of time' : 'almost done';
  const elapsedText = sessionMinutesElapsed > 0 ? `${sessionMinutesElapsed}m inde` : 'lige begyndt';
  const elapsedEnglish = sessionMinutesElapsed > 0 ? `${sessionMinutesElapsed}m in` : 'just getting started';

  if (type === 'session_start') {
    if (isDanish) {
      return `Godmorgen, ${childFirstName}! ${elapsedText}, ${minutesText} tilbage — vi starter ${sessionName} med ${taskTitle}.`;
    }
    return `Morning, ${childFirstName}! ${elapsedEnglish}, ${englishMinutes} left — ${sessionName} begins with ${taskTitle}.`;
  }

  if (type === 'completion') {
    if (isDanish) {
      return nextTaskTitle
        ? `Super, ${childFirstName}! ${minutesText} tilbage — nu ${nextTaskTitle}!`
        : `Flot klaret, ${childFirstName}! ${minutesText} til overs!`;
    }

    return nextTaskTitle
      ? `Great job, ${childFirstName}! ${englishMinutes} left — next is ${nextTaskTitle}!`
      : `Way to go finishing ${taskTitle}, ${childFirstName}! ${englishMinutes} to spare!`;
  }

  if (isDanish) {
    return `Kom så, ${childFirstName}! ${secondsText} på ${taskTitle}!`;
  }

  return `Let’s go, ${childFirstName}! You’re ${englishSeconds} on ${taskTitle}!`;
};

const SYSTEM_PROMPT = `You are Klar Parat, a cheerful morning coach helping young kids get ready at home before they leave for the day.
Speak in short, lively sentences (1–3) with zero shame and lots of encouragement.
You receive structured JSON with details about the child, routine, timing, and nudges.
Event types:
- session_start — welcome the child, frame today’s routine, highlight the first task, and mention how much time there is.
- nudge — mid-task encouragement referencing progress and the pace/urgency data provided.
- completion — celebrate the finished task, preview the next task (or wrap the session) and comment on how the schedule looks.
Always use the child’s first name and comment honestly on whether there is plenty of time or if everyone needs to hurry.
Never invent details that are not in the context.
Respond ONLY with valid JSON: {"text":"..."} ready to be spoken aloud.`;

let openAiClient: OpenAIClient | null = null;
let openAiConstructor: (new (config: { apiKey: string }) => OpenAIClient) | null = null;

const getOpenAiClient = async (): Promise<OpenAIClient> => {
  if (openAiClient) {
    return openAiClient;
  }

  if (!openAiConstructor) {
    try {
      const module = await import('openai');
      openAiConstructor = module.default as unknown as new (config: { apiKey: string }) => OpenAIClient;
    } catch (error) {
      throw new Error('OPENAI_SDK_UNAVAILABLE');
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openAiClient = new openAiConstructor!({ apiKey });
  return openAiClient;
};

const callOpenAi = async ({
  context,
  language
}: {
  context: Record<string, unknown>;
  language: string;
}): Promise<string | null> => {
  const client = await getOpenAiClient();
  const userPrompt = [
    `Language: ${describeLanguage(language)}`,
    'You are speaking aloud to the child right now.',
    'Use the timing details to judge urgency honestly.',
    'JSON context follows:',
    JSON.stringify(context, null, 2),
    'Respond with JSON {"text":"..."} only.'
  ].join('\n');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 220,
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
        return validated.text;
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

    const sessionStartAt = session.actualStartAt ?? session.plannedStartAt;
    const startedAt = task.startedAt ?? sessionStartAt;
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
    const totalSeconds = Math.max(1, Math.round(task.expectedMinutes * 60));
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const currentProgressRatio = Math.min(1, Number((elapsedSeconds / totalSeconds).toFixed(2)));

    const sessionElapsedSeconds = Math.max(0, Math.floor((now.getTime() - sessionStartAt.getTime()) / 1000));
    const sessionRemainingSeconds = Math.max(0, Math.floor((session.plannedEndAt.getTime() - now.getTime()) / 1000));
    const sessionMinutesElapsed = Math.floor(sessionElapsedSeconds / 60);
    const sessionMinutesRemaining = urgency.timeRemainingMinutes;
    const sessionWindowMinutes = Math.max(
      1,
      Math.round((session.plannedEndAt.getTime() - sessionStartAt.getTime()) / 60000)
    );

    const totalTasks = session.tasks.length;
    const completedTasks = session.tasks.filter((item) => item.completedAt || item.skipped).length;
    const remainingTasks = Math.max(0, totalTasks - completedTasks);
    const expectedRemainingMinutes = session.tasks
      .filter((item) => !item.completedAt && !item.skipped)
      .reduce((total, item) => total + item.expectedMinutes, 0);

    const firedDates = thresholds
      .map((threshold) => task[threshold.key])
      .filter((value): value is Date => Boolean(value));
    const nextThreshold = thresholds.find((threshold) => !task[threshold.key]);
    const requestedNudge = type === 'nudge' ? nudgeThreshold ?? nextThreshold?.label ?? null : null;

    const nextTaskCandidate = session.tasks
      .filter((item) => item.orderIndex > task.orderIndex && !item.completedAt && !item.skipped)
      .sort((a, b) => a.orderIndex - b.orderIndex)[0];
    const previousTaskCandidate = session.tasks
      .filter((item) => item.orderIndex < task.orderIndex && (item.completedAt || item.skipped))
      .sort((a, b) => b.orderIndex - a.orderIndex)[0];

    const eventSummary = (() => {
      if (type === 'session_start') {
        return 'Kick off the routine, set the tone, and introduce the first task with timing awareness.';
      }
      if (type === 'completion') {
        return nextTaskCandidate
          ? 'Celebrate the completed task and tee up the next one while checking the clock.'
          : 'Celebrate finishing the last task and reflect on the session pace.';
      }
      return 'Encourage focus on the current task using the remaining time and nudge cadence.';
    })();

    const nudgeKeyMap = {
      first: 'nudgeFirstFiredAt',
      second: 'nudgeSecondFiredAt',
      final: 'nudgeFinalFiredAt'
    } as const;

    const context = {
      event: {
        type,
        summary: eventSummary,
        nowIso: now.toISOString(),
        requestedNudgeThreshold: requestedNudge,
        upcomingNudgeDescription: formatNudgeThreshold(requestedNudge ?? nextThreshold?.label ?? null),
        urgencyLevel: urgency.urgencyLevel,
        paceDelta: urgency.paceDelta,
        sessionMinutesRemaining,
        sessionMinutesElapsed
      },
      environment: {
        scenario: 'Family morning routine before leaving home',
        medium: 'Spoken encouragement delivered through the kid-mode tablet',
        languageCode: language
      },
      child: {
        firstName: session.child.firstName,
        ageYears: toAgeYears(session.child.birthdate, now)
      },
      timing: {
        currentTimeIso: now.toISOString(),
        sessionStartIso: sessionStartAt.toISOString(),
        sessionEndIso: session.plannedEndAt.toISOString(),
        sessionElapsedSeconds,
        sessionRemainingSeconds,
        sessionTimeBudgetMinutes: sessionWindowMinutes
      },
      session: {
        id: session.id,
        name: snapshot.name,
        allowSkip: session.allowSkip,
        totalTasks,
        completedTasks,
        remainingTasks,
        expectedTotalMinutes: session.expectedTotalMinutes,
        expectedRemainingMinutes,
        isComplete: remainingTasks === 0,
        isFinalTask: remainingTasks <= 1 && !nextTaskCandidate
      },
      tasks: {
        current: {
          orderIndex: task.orderIndex,
          title: task.title,
          hint: snapshotByOrder.get(task.orderIndex)?.hint ?? null,
          expectedMinutes: task.expectedMinutes,
          startedAtIso: startedAt.toISOString(),
          elapsedSeconds,
          remainingSeconds,
          progressRatio: currentProgressRatio,
          nudgesFiredCount: firedDates.length,
          totalScheduledNudges: thresholds.length,
          nextNudgeThreshold: nextThreshold?.label ?? null,
          nextNudgeDescription: formatNudgeThreshold(nextThreshold?.label ?? null)
        },
        next: nextTaskCandidate
          ? {
              orderIndex: nextTaskCandidate.orderIndex,
              title: nextTaskCandidate.title,
              hint: snapshotByOrder.get(nextTaskCandidate.orderIndex)?.hint ?? null,
              expectedMinutes: nextTaskCandidate.expectedMinutes
            }
          : null,
        previous: previousTaskCandidate
          ? {
              orderIndex: previousTaskCandidate.orderIndex,
              title: previousTaskCandidate.title,
              skipped: previousTaskCandidate.skipped,
              completedAtIso: previousTaskCandidate.completedAt
                ? previousTaskCandidate.completedAt.toISOString()
                : null
            }
          : null
      },
      nudgeStrategy: {
        perTaskLimit: thresholds.length,
        checkpoints: thresholds.map(({ label }, index) => ({
          threshold: label,
          order: index + 1,
          firedAtIso: task[nudgeKeyMap[label]]
            ? (task[nudgeKeyMap[label]] as Date).toISOString()
            : null
        }))
      }
    } satisfies Record<string, unknown>;

    const flags = loadFeatureFlags();
    let text: string | null = null;

    if (flags.useFakeLLM) {
      text = buildFakeMessage({
        type,
        childFirstName: session.child.firstName,
        sessionName: snapshot.name,
        taskTitle: task.title,
        nextTaskTitle: nextTaskCandidate?.title ?? null,
        sessionMinutesRemaining,
        sessionMinutesElapsed,
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
        sessionName: snapshot.name,
        taskTitle: task.title,
        nextTaskTitle: nextTaskCandidate?.title ?? null,
        sessionMinutesRemaining,
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
