import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaEventRepository } from "../../src/events/PrismaEventRepository";

describe("Feature 8 Sprint 3 - Organizer Dashboard Repository (Prisma)", () => {
    const adapter = new PrismaBetterSqlite3({
        url: "file:./prisma/dev.db",
    });

    const prisma = new PrismaClient({ adapter });
    const repo = new PrismaEventRepository(prisma);

    beforeEach(async () => {
        await prisma.rSVP.deleteMany({
            where: {
                eventId: {
                in: ["e1", "e2", "e3"],
                },
            },
        });

        await prisma.event.deleteMany({
            where: {
                id: {
                in: ["e1", "e2", "e3"],
                },
            },
        });

        await prisma.event.createMany({
            data: [
                {
                    id: "e1",
                    title: "Org 1 Draft",
                    description: "draft",
                    location: "A",
                    category: "tech",
                    status: "draft",
                    capacity: 10,
                    startDatetime: new Date("2030-01-01"),
                    endDatetime: new Date("2030-01-01"),
                    organizerId: "user-staff",
                },
                {
                    id: "e2",
                    title: "Org 1 Published",
                    description: "published",
                    location: "B",
                    category: "tech",
                    status: "published",
                    capacity: 10,
                    startDatetime: new Date("2030-01-02"),
                    endDatetime: new Date("2030-01-02"),
                    organizerId: "user-staff",
                },
                {
                    id: "e3",
                    title: "Org 2 Event",
                    description: "other org",
                    location: "C",
                    category: "music",
                    status: "published",
                    capacity: 20,
                    startDatetime: new Date("2030-01-03"),
                    endDatetime: new Date("2030-01-03"),
                    organizerId: "user-admin",
                },
            ],
        });
    });

    afterAll(async () => {
        await prisma.rSVP.deleteMany({
            where: {
            eventId: {
                in: ["e1", "e2", "e3"],
            },
            },
        });

        await prisma.event.deleteMany({
            where: {
            id: {
                in: ["e1", "e2", "e3"],
            },
            },
        });
        await prisma.$disconnect();
    });

    it("returns only events belonging to the organizer (Prisma filter check)", async () => {
        const result = await repo.findByOrganizer("user-staff");

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        
        const testEvents = result.value.filter(
            e => ["e1", "e2"].includes(e.id)
        );

        expect(testEvents.length).toBe(2);
        expect(testEvents.every(
            e => e.organizerId === "user-staff"
        )).toBe(true);

        expect(testEvents.map(e => e.id)).toEqual(
            expect.arrayContaining(["e1", "e2"])
        );
    });

    it("returns empty array when organizer has no events", async () => {
        const result = await repo.findByOrganizer("unknown-organizer");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual([]);
    });

    it("does not leak other organizers' events (strict DB enforcement)", async () => {
        const result = await repo.findByOrganizer("user-staff");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.some(e => e.organizerId === "user-admin")).toBe(false);
    });

    it("Prisma correctly persists status values per organizer", async () => {
        const result = await repo.findByOrganizer("user-staff");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const statuses = result.value.map(e => e.status);
        expect(statuses).toContain("draft");
        expect(statuses).toContain("published");
    });
});