import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaRsvpRepository } from "../../src/rsvp/PrismaRsvpRepository";
import { seedTestDatabase } from "../helper/seed";

describe("PrismaRsvpRepository", () => {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
  });

  const prisma = new PrismaClient({ adapter });
  const repository = new PrismaRsvpRepository(prisma);

  beforeEach(async () => {
    await seedTestDatabase(prisma);

    await prisma.rSVP.deleteMany({
      where: {
        id: {
          in: ["rsvp-early", "rsvp-late"],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["rsvp-test-user-1", "rsvp-test-user-2"],
        },
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: "rsvp-test-user-1",
          email: "rsvp-test-user-1@app.test",
          displayName: "RSVP Test User One",
          role: "user",
          passwordHash: "password123",
        },
        {
          id: "rsvp-test-user-2",
          email: "rsvp-test-user-2@app.test",
          displayName: "RSVP Test User Two",
          role: "user",
          passwordHash: "password123",
        },
      ],
    });

    await prisma.rSVP.createMany({
      data: [
        {
          id: "rsvp-early",
          eventId: "event-published-1",
          userId: "rsvp-test-user-1",
          status: "going",
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
        },
        {
          id: "rsvp-late",
          eventId: "event-published-1",
          userId: "rsvp-test-user-2",
          status: "waitlisted",
          createdAt: new Date("2026-04-05T10:10:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        id: {
          in: ["rsvp-early", "rsvp-late"],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["rsvp-test-user-1", "rsvp-test-user-2"],
        },
      },
    });

    await prisma.$disconnect();
  });

  it("findByEventId returns RSVPs sorted by createdAt ascending", async () => {
    const result = await repository.findByEventId("event-published-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.map((rsvp) => rsvp.id)).toEqual([
      "rsvp-early",
      "rsvp-late",
    ]);
  });

  it("findAttendeesByEventId maps known user IDs to display names", async () => {
    const result = await repository.findAttendeesByEventId(
      "event-published-1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const attendeeNames = result.value.map(
      (attendee) => attendee.displayName,
    );

    expect(attendeeNames).toContain("RSVP Test User One");
    expect(attendeeNames).toContain("RSVP Test User Two");
  });

  it("findByEventId returns an empty array when the event has no RSVPs", async () => {
    const result = await repository.findByEventId("event-published-3");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual([]);
  });

  it("countGoing only counts RSVPs with going status", async () => {
    const result = await repository.countGoing("event-published-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBe(1);
  });

  it("findByUserAndEvent returns null when no RSVP exists", async () => {
    const result = await repository.findByUserAndEvent(
      "rsvp-test-user-1",
      "event-published-3",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toBeNull();
  });
});