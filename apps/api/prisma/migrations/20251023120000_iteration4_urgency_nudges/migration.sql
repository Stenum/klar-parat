PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_session_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "expected_minutes" REAL NOT NULL DEFAULT 1.0,
    "completed_at" DATETIME,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "started_at" DATETIME,
    "nudge_first_fired_at" DATETIME,
    "nudge_second_fired_at" DATETIME,
    "nudge_final_fired_at" DATETIME,
    CONSTRAINT "session_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_session_tasks" (
    "id",
    "session_id",
    "order_index",
    "title",
    "expected_minutes",
    "completed_at",
    "skipped",
    "started_at",
    "nudge_first_fired_at",
    "nudge_second_fired_at",
    "nudge_final_fired_at"
)
SELECT
    "id",
    "session_id",
    "order_index",
    "title",
    "expected_minutes",
    "completed_at",
    "skipped",
    NULL,
    NULL,
    NULL,
    NULL
FROM "session_tasks";

DROP TABLE "session_tasks";
ALTER TABLE "new_session_tasks" RENAME TO "session_tasks";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
