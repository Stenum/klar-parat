import type { Session } from '@shared/schemas';

import type { SessionProgressState } from '../types/session';

export const deriveSessionProgress = (session: Session | null): SessionProgressState[] =>
  session
    ? session.tasks.map((task) => ({
        completed: Boolean(task.completedAt),
        skipped: task.skipped
      }))
    : [];
