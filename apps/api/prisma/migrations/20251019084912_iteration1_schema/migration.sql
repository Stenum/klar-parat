-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "first_name" TEXT NOT NULL,
    "birthdate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "default_start_time" TEXT NOT NULL,
    "default_end_time" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "template_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "template_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "hint" TEXT,
    "expected_minutes" REAL NOT NULL DEFAULT 1.0,
    CONSTRAINT "template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "template_snapshot" TEXT NOT NULL,
    "planned_start_at" DATETIME NOT NULL,
    "planned_end_at" DATETIME NOT NULL,
    "actual_start_at" DATETIME,
    "actual_end_at" DATETIME,
    "expected_total_minutes" REAL NOT NULL,
    "medal" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expected_minutes" REAL NOT NULL DEFAULT 1.0,
    "completed_at" DATETIME,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "session_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
