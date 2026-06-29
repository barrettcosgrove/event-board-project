import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createComposedAppWithPrisma } from "../../src/composition";
import { loginAs } from "../helper/auth";
import { seedTestDatabase } from "../helper/seed";

describe("Feature 7 Sprint 3 - RSVP Dashboard Integration (Prisma)", () => {
    const adapter = new PrismaBetterSqlite3({
        url: "file:./prisma/dev.db",
    });

    const prisma = new PrismaClient({ adapter });
    const app = createComposedAppWithPrisma({ usePrismaRsvp: true }).getExpressApp();

    beforeEach(async () => {
        await seedTestDatabase(prisma);
        await prisma.rSVP.createMany({
            data: [
                {
                    id: "rsvp-upcoming-1",
                    userId: "user-reader",
                    eventId: "event-published-1",
                    status: "going",
                    createdAt: new Date("2026-04-01T10:00:00Z"),
                },
                {
                    id: "rsvp-upcoming-2",
                    userId: "user-reader",
                    eventId: "event-published-2",
                    status: "waitlisted",
                    createdAt: new Date("2026-04-02T10:00:00Z"),
                },
                {
                    id: "rsvp-past",
                    userId: "user-reader",
                    eventId: "event-past-1",
                    status: "going",
                    createdAt: new Date("2026-03-01T10:00:00Z"),
                },
            ],
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });
    it("redirects unauthenticated users to login", async () => {
        const response = await request(app).get("/rsvps");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/login");
    });

    it("prevents organizers from accessing the dashboard", async () => {
        const organizerAgent = await loginAs(app, "organizer@app.test", "password123");
        const response = await organizerAgent.get("/rsvps");

        expect(response.status).toBe(302);
    });

    it("allows regular users to access the dashboard", async () => {
        const userAgent = await loginAs(app, "user@app.test", "password123");
        const response = await userAgent.get("/rsvps");
        expect(response.status).toBe(200);
    });

    it("groups RSVPs into upcoming and past sections", async () => {
        const userAgent = await loginAs(app, "user@app.test", "password123");
        const response = await userAgent.get("/rsvps");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Upcoming Events");
        expect(response.text).toContain("Past &amp; Cancelled Events");
        expect(response.text).toContain("event-published-1");
        expect(response.text).toContain("Past Music Night");
    });

    it("sorts upcoming events by soonest start date", async () => {
        const userAgent = await loginAs(app, "user@app.test", "password123");
        const response = await userAgent.get("/rsvps");

        expect(response.status).toBe(200);
        const first = response.text.indexOf("Graduation Celebration");
        const second = response.text.indexOf("Spring Picnic");
        expect(first).toBeGreaterThan(-1);
        expect(second).toBeGreaterThan(-1);
        expect(first).toBeLessThan(second);
    });

    it("removes RSVP from upcoming after canceling", async () => {
        const userAgent = await loginAs(app, "user@app.test", "password123");
        await userAgent.post("/events/event-published-2/rsvp");
        const dashboard = await userAgent.get("/rsvps");
        expect(dashboard.status).toBe(200);
        expect(dashboard.text).toContain("Past &amp; Cancelled Events");
        expect(dashboard.text).toContain("Graduation Celebration");
    });

    it("only shows RSVPs belonging to the logged-in user", async () => {
        await prisma.rSVP.deleteMany({
            where: {
                id: "rsvp-other-user",
            },
        });
        
        await prisma.user.deleteMany({
            where: {
                id: "rsvp-dashboard-other-user",
            },
        });

        await prisma.user.create({
            data: {
                id: "rsvp-dashboard-other-user",
                email: "rsvp-dashboard-other-user@app.test",
                displayName: "RSVP Dashboard Other User",
                role: "user",
                passwordHash: "password123",
            },
        });

        await prisma.rSVP.create({
            data: {
                id: "rsvp-other-user",
                userId: "rsvp-dashboard-other-user",
                eventId: "event-published-2",
                status: "going",
                createdAt: new Date(),
            },
        });

        const userAgent = await loginAs(app, "user@app.test", "password123");
        const response = await userAgent.get("/rsvps");

        expect(response.status).toBe(200);
        expect(response.text).not.toContain("rsvp-other-user");
    });
});