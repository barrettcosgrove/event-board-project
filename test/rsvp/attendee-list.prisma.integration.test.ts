import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createComposedAppWithPrisma } from "../../src/composition";
import { loginAs } from "../helper/auth";
import { seedTestDatabase } from "../helper/seed";

describe("Feature 12 Sprint 3 - Attendee List integration (Prisma)", () => {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });
  const app = createComposedAppWithPrisma({
    usePrismaEvent: true,
    usePrismaRsvp: true,
  }).getExpressApp();

  beforeEach(async () => {
    await seedTestDatabase(prisma);
    await prisma.rSVP.createMany({
      data: [
        {
          id: "rsvp-going-1",
          eventId: "event-published-1",
          userId: "user-reader",
          status: "going",
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
        },
        {
          id: "rsvp-waitlisted-1",
          eventId: "event-published-1",
          userId: "user-admin",
          status: "waitlisted",
          createdAt: new Date("2026-04-05T10:05:00.000Z"),
        },
        {
          id: "rsvp-going-2",
          eventId: "event-published-1",
          userId: "user-staff",
          status: "going",
          createdAt: new Date("2026-04-05T10:10:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows staff organizer to view attendee list for their own event", async () => {
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text).toContain("Going");
    expect(response.text).toContain("Waitlisted");
    expect(response.text).toContain("Cancelled");
  });

  it("shows attendee display names and ascending createdAt order within each group", async () => {
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Una User");
    expect(response.text).toContain("Avery Admin");
    expect(response.text).toContain("Sam Staff");

    const goingSectionMatch = response.text.match(
      /<h2 class="text-xl font-semibold text-slate-900 mb-3">Going<\/h2>([\s\S]*?)<\/section>/,
    );
    expect(goingSectionMatch).not.toBeNull();

    const goingSection = goingSectionMatch![1];
    const unaUserPosition = goingSection.indexOf("Una User");
    const samStaffPosition = goingSection.indexOf("Sam Staff");
    expect(unaUserPosition).toBeGreaterThanOrEqual(0);
    expect(samStaffPosition).toBeGreaterThanOrEqual(0);
    expect(unaUserPosition).toBeLessThan(samStaffPosition);
  });

  it("allows admin and rejects regular user for attendee list access", async () => {
    const adminAgent = await loginAs(app, "admin@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const adminResponse = await adminAgent.get("/events/event-published-1/attendees");
    const userResponse = await userAgent.get("/events/event-published-1/attendees");

    expect(adminResponse.status).toBe(200);
    expect(userResponse.status).toBe(403);
    expect(userResponse.text).toContain("Users cannot view attendee lists");
  });

  it("returns HTMX partial attendee list when HX-Request is true", async () => {
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent
      .get("/events/event-published-1/attendees")
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text.toLowerCase()).not.toContain("<!doctype html>");
    expect(response.text.toLowerCase()).not.toContain("<html");
  });

  it("redirects unauthenticated users to login", async () => {
    const response = await request(app).get("/events/event-published-1/attendees");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });
});
