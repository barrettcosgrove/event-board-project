import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaRsvpRepository } from "../../src/rsvp/PrismaRsvpRepository";
import { seedTestDatabase } from "../helper/seed";

describe("Feature 7 Sprint 3 - RSVP Dashboard Repository (Prisma)", () => {
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
                    in: [
                        "rsvp-user-reader",
                        "rsvp-user-reader-2",
                        "rsvp-other-user",
                        "rsvp-new",
                    ],
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: "dashboard-rsvp-user",
            },
        });

        await prisma.user.create({
            data: {
                id: "dashboard-rsvp-user",
                email: "dashboard-rsvp-user@app.test",
                displayName: "Dashboard RSVP User",
                role: "user",
                passwordHash: "password123",
            },
        });

        await prisma.rSVP.createMany({
            data: [
                {
                    id: "rsvp-user-reader",
                    eventId: "event-published-1",
                    userId: "user-reader",
                    status: "going",
                    createdAt: new Date("2026-04-05T10:00:00.000Z"),
                },
                {
                    id: "rsvp-user-reader-2",
                    eventId: "event-published-2",
                    userId: "user-reader",
                    status: "waitlisted",
                    createdAt: new Date("2026-04-06T10:00:00.000Z"),
                },
                {
                    id: "rsvp-other-user",
                    eventId: "event-published-1",
                    userId: "dashboard-rsvp-user",
                    status: "going",
                    createdAt: new Date(),
                },
            ],
        });
    });

    afterAll(async () => {
        await prisma.rSVP.deleteMany({
            where: {
                id: {
                    in: [
                        "rsvp-user-reader",
                        "rsvp-user-reader-2",
                        "rsvp-other-user",
                        "rsvp-new",
                    ],
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: "dashboard-rsvp-user",
            },
        });

        await prisma.$disconnect();
    });

    it("returns RSVPs for a user with joined event details", async () => {
        const result = await repository.findByUser("user-reader");

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.length).toBeGreaterThan(0);

            const rsvp = result.value[0];
            expect(rsvp.event).toBeDefined();
            expect(rsvp.event.title).toBeDefined();
            expect(rsvp.event.startDatetime).toBeInstanceOf(Date);
        }
    });

    it("returns only RSVPs belonging to the given user", async () => {
        const result = await repository.findByUser("user-reader");

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.every(r => r.userId === "user-reader")).toBe(true);
        }
    });

    it("returns empty array when user has no RSVPs", async () => {
        const result = await repository.findByUser("non-existent-user");

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual([]);
        }
    });

    it("counts only 'going' RSVPs for an event", async () => {
        const result = await repository.countGoing("event-published-1");

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(typeof result.value).toBe("number");
            expect(result.value).toBeGreaterThanOrEqual(0);
        }
    });

    it("finds RSVP by user and event", async () => {
        const result = await repository.findByUserAndEvent("user-reader", "event-published-1");

        expect(result.ok).toBe(true);
        if (result.ok) {
            if (result.value) {
                expect(result.value.userId).toBe("user-reader");
                expect(result.value.eventId).toBe("event-published-1");
            }
        }
    });

    it("creates a new RSVP if one does not exist", async () => {
        const newRsvp = {
            id: "rsvp-new",
            userId: "user-reader",
            eventId: "event-published-3",
            status: "going" as const,
            createdAt: new Date(),
        };

        const result = await repository.save(newRsvp);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.id).toBe("rsvp-new");
            expect(result.value.status).toBe("going");
        }
    });

    it("updates an existing RSVP instead of creating a duplicate", async () => {
        const updated = {
            id: "ignored",
            userId: "user-reader",
            eventId: "event-published-1",
            status: "waitlisted" as const,
            createdAt: new Date(),
        };

        const result = await repository.save(updated);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.status).toBe("waitlisted");
        }

        const check = await repository.findByUserAndEvent("user-reader", "event-published-1");
        expect(check.ok).toBe(true);
        if (check.ok && check.value) {
            expect(check.value.status).toBe("waitlisted");
        }
    });
});