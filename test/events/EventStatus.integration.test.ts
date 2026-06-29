import request from "supertest";
import type { Express } from "express";
import { createComposedApp, createComposedAppWithPrisma} from "../../src/composition";
import { loginAs } from "../helper/auth";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { seedTestDatabase } from "../helper/seed";

const USER_EMAIL = "user@app.test";
const USER_PASSWORD = "password123";

const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

describe("Feature 5: Event Publishing and Cancellation", () => {
  let app: Express;

  beforeEach(() => {
    app = createComposedApp().getExpressApp();
  });

  it("returns 302 to dashboard when staff publishes their own draft via regular form submission", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when staff publishes via HTMX request", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("Cancel Event");
  });

  it("returns 302 to dashboard when staff cancels their own published event via regular form submission", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when staff cancels via HTMX request", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("This event is cancelled.");
  });

  it("returns 302 to dashboard when admin publishes their own draft via regular form submission", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when admin publishes via HTMX request", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("Cancel Event");
  });

  it("returns 302 to dashboard when admin cancels their own published event via regular form submission", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when admin cancels via HTMX request", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("This event is cancelled.");
  });

  it("returns 401 when an unauthenticated user POSTs publish", async () => {
    const res = await request(app).post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("returns 401 when an unauthenticated user POSTs cancel", async () => {
    const res = await request(app).post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("returns 403 when regular user tries to publish an event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when regular user tries to cancel an event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff tries to publish someone else's draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-admin/publish`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff tries to cancel someone else's published event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-2/cancel`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when trying to publish a missing event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/missing/publish`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when trying to cancel a missing event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/missing/cancel`);
    expect(res.status).toBe(404);
  });

  it("returns 400 when publishing an already published event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/publish`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when canceling a cancelled event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-cancelled-1/cancel`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when publishing a cancelled event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-cancelled-1/publish`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when canceling a draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/cancel`);
    expect(res.status).toBe(400);
  });

  it("event detail shows Cancel button after publishing via regular form", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await agent.post("/events/event-draft-1/publish");
    const res = await agent.get("/events/event-draft-1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Cancel Event");
    expect(res.text).not.toContain("Publish Event");
  });

  it("event detail shows cancelled message after cancelling via regular form", async () => {
      const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
      await agent.post("/events/event-published-1/cancel");
      const res = await agent.get("/events/event-published-1");
      expect(res.status).toBe(200);
      expect(res.text).toContain("This event is cancelled.");
      expect(res.text).not.toContain("Cancel Event");
  }); 

  it("cancelled event no longer appears in public event list", async () => {
    const staffAgent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await staffAgent.post("/events/event-published-1/cancel");

    const userAgent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await userAgent.get("/events");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Spring Picnic");
  });

  it("published event appears in public event list after publishing", async () => {
    const staffAgent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await staffAgent.post("/events/event-draft-1/publish");

    const userAgent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await userAgent.get("/events");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });
});

describe("Feature 5: Event Publishing and Cancellation - Prisma", () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(() => {
    const adapter = new PrismaBetterSqlite3({
      url: "file:./prisma/dev.db",
    });
    prisma = new PrismaClient({ adapter });
  });

  beforeEach(async () => {
    await seedTestDatabase(prisma);
    app = createComposedAppWithPrisma({usePrismaEvent: true}).getExpressApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 302 to dashboard when staff publishes their own draft via regular form submission", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when staff publishes via HTMX request", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("Cancel Event");
  });

  it("returns 302 to dashboard when staff cancels their own published event via regular form submission", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when staff cancels via HTMX request", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("This event is cancelled.");
  });

  it("returns 302 to dashboard when admin publishes their own draft via regular form submission", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when admin publishes via HTMX request", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("Cancel Event");
  });

  it("returns 302 to dashboard when admin cancels their own published event via regular form submission", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/events/dashboard");
  });

  it("returns 200 with status controls partial when admin cancels via HTMX request", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`).set("HX-Request", "true");
    expect(res.status).toBe(200);
    expect(res.text).toContain("event-status-controls");
    expect(res.text).toContain("This event is cancelled.");
  });

  it("returns 401 when an unauthenticated user POSTs publish", async () => {
    const res = await request(app).post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("returns 401 when an unauthenticated user POSTs cancel", async () => {
    const res = await request(app).post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  it("returns 403 when regular user tries to publish an event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/publish`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when regular user tries to cancel an event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post(`/events/event-published-1/cancel`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff tries to publish someone else's draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-admin/publish`);
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff tries to cancel someone else's published event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-2/cancel`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when trying to publish a missing event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/missing/publish`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when trying to cancel a missing event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/missing/cancel`);
    expect(res.status).toBe(404);
  });

  it("returns 400 when publishing an already published event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-published-1/publish`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when canceling a cancelled event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-cancelled-1/cancel`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when publishing a cancelled event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-cancelled-1/publish`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when canceling a draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post(`/events/event-draft-1/cancel`);
    expect(res.status).toBe(400);
  });

  it("event detail shows Cancel button after publishing via regular form", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await agent.post("/events/event-draft-1/publish");
    const res = await agent.get("/events/event-draft-1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Cancel Event");
    expect(res.text).not.toContain("Publish Event");
  });

  it("event detail shows cancelled message after cancelling via regular form", async () => {
      const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
      await agent.post("/events/event-published-1/cancel");
      const res = await agent.get("/events/event-published-1");
      expect(res.status).toBe(200);
      expect(res.text).toContain("This event is cancelled.");
      expect(res.text).not.toContain("Cancel Event");
  }); 

  it("cancelled event no longer appears in public event list", async () => {
    const staffAgent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await staffAgent.post("/events/event-published-1/cancel");

    const userAgent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await userAgent.get("/events");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Spring Picnic");
  });

  it("published event appears in public event list after publishing", async () => {
    const staffAgent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    await staffAgent.post("/events/event-draft-1/publish");

    const userAgent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await userAgent.get("/events");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });
});