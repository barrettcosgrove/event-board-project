import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createComposedAppWithPrisma } from "../../src/composition";
import { loginAs } from "../helper/auth";

describe("Feature 8: Organizer Dashboard (Prisma)", () => {
    const adapter = new PrismaBetterSqlite3({
        url: "file:./prisma/dev.db",
    });

    const prisma = new PrismaClient({ adapter });
    const app = createComposedAppWithPrisma({
        usePrismaEvent: true,
    }).getExpressApp();

    beforeEach(async () => {
        await prisma.rSVP.deleteMany();

        await prisma.event.deleteMany({
            where: {
                id: {
                    in: ["e1", "e2", "e3"],
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: [
                        "dashboard-user-1",
                        "dashboard-user-2",
                        "dashboard-user-3",
                    ],
                },
            },
        });

        await prisma.user.createMany({
            data: [
                {
                    id: "dashboard-user-1",
                    email: "dashboard-user-1@app.test",
                    displayName: "Dashboard User One",
                    role: "user",
                    passwordHash: "password123",
                },
                {
                    id: "dashboard-user-2",
                    email: "dashboard-user-2@app.test",
                    displayName: "Dashboard User Two",
                    role: "user",
                    passwordHash: "password123",
                },
                {
                    id: "dashboard-user-3",
                    email: "dashboard-user-3@app.test",
                    displayName: "Dashboard User Three",
                    role: "user",
                    passwordHash: "password123",
                },
            ],
        });

        await prisma.event.createMany({
            data: [
                {
                    id: "e1",
                    title: "Org1 Draft",
                    description: "draft event",
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
                    title: "Org1 Published",
                    description: "published event",
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
                    title: "Org2 Published",
                    description: "published event",
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

        await prisma.rSVP.createMany({
            data: [
                {
                    id: "r1",
                    eventId: "e2",
                    userId: "dashboard-user-1",
                    status: "going",
                    createdAt: new Date(),
                },
                {
                    id: "r2",
                    eventId: "e2",
                    userId: "dashboard-user-2",
                    status: "going",
                    createdAt: new Date(),
                },
                {
                    id: "r3",
                    eventId: "e3",
                    userId: "dashboard-user-3",
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
                    in: ["r1", "r2", "r3"],
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

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: [
                        "dashboard-user-1",
                        "dashboard-user-2",
                        "dashboard-user-3",
                    ],
                },
            },
        });

        await prisma.$disconnect();
    });

    it("organizer only sees their own events (Prisma enforced)", async () => {
        const agent = await loginAs(
            app,
            "staff@app.test",
            "password123",
        );

        const res = await agent.get("/events/dashboard");

        expect(res.status).toBe(200);
        expect(res.text).toContain("Org1 Draft");
        expect(res.text).toContain("Org1 Published");
        expect(res.text).not.toContain("Org2 Published");
    });

    it("admin sees all events across organizers", async () => {
        const agent = await loginAs(
            app,
            "admin@app.test",
            "password123",
        );

        const res = await agent.get("/events/dashboard");

        expect(res.status).toBe(200);
        expect(res.text).toContain("Org1 Draft");
        expect(res.text).toContain("Org1 Published");
        expect(res.text).toContain("Org2 Published");
    });

    it("attendee counts reflect Prisma RSVP aggregation", async () => {
        const agent = await loginAs(
            app,
            "staff@app.test",
            "password123",
        );

        const res = await agent.get("/events/dashboard");

        expect(res.status).toBe(200);
        expect(res.text).toContain("Org1 Published");
        expect(res.text).toContain("/ 10");
    });

    it("members are blocked even with valid Prisma data", async () => {
        const agent = await loginAs(
            app,
            "user@app.test",
            "password123",
        );

        const res = await agent.get("/events/dashboard");

        expect(res.status).toBe(403);
    });
});