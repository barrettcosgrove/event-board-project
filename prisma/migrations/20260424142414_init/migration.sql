/*
  Warnings:

  - Added the required column `updatedAt` to the `RSVP` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RSVP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RSVP" ("createdAt", "eventId", "id", "status", "userId") SELECT "createdAt", "eventId", "id", "status", "userId" FROM "RSVP";
DROP TABLE "RSVP";
ALTER TABLE "new_RSVP" RENAME TO "RSVP";
CREATE UNIQUE INDEX "RSVP_userId_eventId_key" ON "RSVP"("userId", "eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
