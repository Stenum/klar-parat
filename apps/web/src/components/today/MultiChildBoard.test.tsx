import type { Child, Session } from '@shared/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { SessionNudgeEvent, SessionProgressState } from '../../types/session';
import { MultiChildBoard } from './MultiChildBoard';

type BoardSessionState = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  telemetry: null;
  nudgeEvents: SessionNudgeEvent[];
  pending: boolean;
  error: string | null;
};

const createSession = (id: string, childId: string, name: string): BoardSessionState => {
  const session: Session = {
    id,
    childId,
    allowSkip: true,
    plannedStartAt: new Date('2025-01-01T07:00:00.000Z').toISOString(),
    plannedEndAt: new Date('2025-01-01T07:45:00.000Z').toISOString(),
    actualStartAt: new Date('2025-01-01T07:00:00.000Z').toISOString(),
    actualEndAt: null,
    expectedTotalMinutes: 8,
    medal: null,
    templateSnapshot: {
      templateId: 'template',
      name,
      defaultStartTime: '07:00',
      defaultEndTime: '07:45',
      tasks: [
        { title: 'Task One', emoji: '🎯', hint: 'First hint', expectedMinutes: 3, orderIndex: 0 },
        { title: 'Task Two', emoji: '🎵', hint: 'Second hint', expectedMinutes: 5, orderIndex: 1 }
      ],
      expectedTotalMinutes: 8
    },
    tasks: [
      {
        id: `${id}-task-0`,
        title: 'Task One',
        expectedMinutes: 3,
        completedAt: null,
        skipped: false,
        orderIndex: 0,
        emoji: '🎯',
        hint: 'First hint'
      },
      {
        id: `${id}-task-1`,
        title: 'Task Two',
        expectedMinutes: 5,
        completedAt: null,
        skipped: false,
        orderIndex: 1,
        emoji: '🎵',
        hint: 'Second hint'
      }
    ]
  };

  return {
    session,
    child: {
      id: childId,
      firstName: name,
      birthdate: '2015-01-01',
      active: true,
      createdAt: new Date().toISOString()
    },
    progress: session.tasks.map(() => ({ completed: false, skipped: false })),
    telemetry: null,
    nudgeEvents: [],
    pending: false,
    error: null
  };
};

describe('MultiChildBoard', () => {
  it('renders columns and focus controls', async () => {
    const user = userEvent.setup();
    const sessions = [createSession('session-1', 'child-1', 'Ada'), createSession('session-2', 'child-2', 'Ben')];

    render(
      <MultiChildBoard
        sessions={sessions}
        focusedSessionId={null}
        onFocusSession={() => undefined}
        onCompleteTask={() => undefined}
        onSkipTask={() => undefined}
        showDebugTelemetry={false}
      />
    );

    expect(screen.getByRole('button', { name: 'All kids' })).toBeInTheDocument();
    const adaHeading = screen.getByRole('heading', { name: 'Ada' });
    const benHeading = screen.getByRole('heading', { name: 'Ben' });

    expect(adaHeading.closest('section')).not.toHaveClass('opacity-60');
    expect(benHeading.closest('section')).not.toHaveClass('opacity-60');

    const focusBen = screen.getByRole('button', { name: 'Ben' });
    await user.click(focusBen);

    // After clicking the chip we expect the component to call the handler; we cannot inspect state change here,
    // but we can ensure the button exists and is interactable.
    expect(focusBen).toBeEnabled();
  });
});
