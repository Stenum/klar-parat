/*
  Warnings:

  - Added the required column `order_index` to the `session_tasks` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
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
    CONSTRAINT "session_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_session_tasks" ("completed_at", "expected_minutes", "id", "order_index", "session_id", "skipped", "title")
SELECT
    "completed_at",
    "expected_minutes",
    "id",
    COALESCE(
        ROW_NUMBER() OVER (
            PARTITION BY "session_id"
            ORDER BY "rowid"
        ) - 1,
        0
    ) AS "order_index",
    "session_id",
    "skipped",
    "title"
FROM "session_tasks";
DROP TABLE "session_tasks";
ALTER TABLE "new_session_tasks" RENAME TO "session_tasks";
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "template_snapshot" TEXT NOT NULL,
    "planned_start_at" DATETIME NOT NULL,
    "planned_end_at" DATETIME NOT NULL,
    "allow_skip" BOOLEAN NOT NULL DEFAULT false,
    "actual_start_at" DATETIME,
    "actual_end_at" DATETIME,
    "expected_total_minutes" REAL NOT NULL,
    "medal" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("actual_end_at", "actual_start_at", "allow_skip", "child_id", "created_at", "expected_total_minutes", "id", "medal", "planned_end_at", "planned_start_at", "template_snapshot")
SELECT "actual_end_at", "actual_start_at", false, "child_id", "created_at", "expected_total_minutes", "id", "medal", "planned_end_at", "planned_start_at", "template_snapshot" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
