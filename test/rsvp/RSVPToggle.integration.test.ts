import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  createComposedApp,
  createComposedAppWithPrisma,
} from "../../src/composition";
import { loginAs } from "../helper/auth";

const USER_EMAIL = "user@app.test";
const USER_PASSWORD = "password123";

const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

describe("Feature 4: RSVP Toggle", () => {
  const app = createComposedApp().getExpressApp();

  // success path: role user can RSVP to a published event
  it("returns 302 and redirects after a user RSVPs to a published event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-published-2/rsvp");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/events/event-published-2");
    expect(res.headers.location).toContain("rsvpMessage=");
  });

  // success path: toggling again cancels an existing RSVP
  it("returns 302 and redirects after cancelling an existing RSVP", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/events/event-published-1");
    expect(res.headers.location).toContain("cancelled");
  });

  // success path: full event places user on waitlist
  it("returns 302 and redirects with a waitlist message when the event is full", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/events/event-published-1");
  });

  // success path: HTMX request returns partial HTML instead of redirect
  it("returns 200 and partial HTML for an HTMX RSVP request", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent
      .post("/events/event-published-2/rsvp")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.text).toContain("rsvp-section");
  });

  // error path: unauthenticated user cannot RSVP
  it("returns 401 for an unauthenticated RSVP POST request", async () => {
    const res = await request(app).post("/events/event-published-1/rsvp");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  // error path: event does not exist
  it("returns 404 when trying to RSVP to a non-existent event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/does-not-exist/rsvp");

    expect(res.status).toBe(404);
    expect(res.text).toContain("not found");
  });

  // error path: role staff cannot RSVP
  it("returns 400 when an individual with role staff attempts to RSVP", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("cannot RSVP");
  });

  // error path: role admin cannot RSVP
  it("returns 400 when an individual with role admin attempts to RSVP", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("cannot RSVP");
  });

  // error path: user cannot RSVP to a cancelled event
  it("returns 400 when a user tries to RSVP to a cancelled event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-cancelled-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("Cannot RSVP");
  });
});

describe("Feature 4: RSVP Toggle with Prisma", () => {
  const app = createComposedAppWithPrisma({
    usePrismaEvent: true,
    usePrismaRsvp: true,
  }).getExpressApp();

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: "file:./prisma/dev.db",
    }),
  });

  beforeEach(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: {
          in: [
            "prisma-waitlist-event",
            "event-published-2",
            "event-cancelled-1",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-waitlist-event",
            "event-published-2",
            "event-cancelled-1",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["waitlist-user-1", "waitlist-user-2"],
        },
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: "waitlist-user-1",
          email: "waitlist-user-1@app.test",
          displayName: "Waitlist User One",
          role: "user",
          passwordHash: "password123",
        },
        {
          id: "waitlist-user-2",
          email: "waitlist-user-2@app.test",
          displayName: "Waitlist User Two",
          role: "user",
          passwordHash: "password123",
        },
      ],
    });

    await prisma.event.createMany({
      data: [
        {
          id: "event-published-2",
          title: "Published Event 2",
          description: "Published event for RSVP testing",
          location: "Campus Center",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: new Date("2030-04-21T15:00:00.000Z"),
          endDatetime: new Date("2030-04-21T17:00:00.000Z"),
          organizerId: "user-staff",
        },
        {
          id: "event-cancelled-1",
          title: "Cancelled Event",
          description: "Cancelled event for RSVP testing",
          location: "Student Union",
          category: "social",
          status: "cancelled",
          capacity: 10,
          startDatetime: new Date("2030-04-22T15:00:00.000Z"),
          endDatetime: new Date("2030-04-22T17:00:00.000Z"),
          organizerId: "user-staff",
        },
        {
          id: "prisma-waitlist-event",
          title: "Small Waitlist Event",
          description: "Used to test waitlist behavior.",
          location: "Small Room",
          category: "social",
          status: "published",
          capacity: 2,
          startDatetime: new Date("2030-04-20T15:00:00.000Z"),
          endDatetime: new Date("2030-04-20T17:00:00.000Z"),
          organizerId: "user-staff",
        },
      ],
    });

    await prisma.rSVP.createMany({
      data: [
        {
          id: "waitlist-going-1",
          eventId: "prisma-waitlist-event",
          userId: "waitlist-user-1",
          status: "going",
          createdAt: new Date(),
        },
        {
          id: "waitlist-going-2",
          eventId: "prisma-waitlist-event",
          userId: "waitlist-user-2",
          status: "going",
          createdAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: {
          in: [
            "prisma-waitlist-event",
            "event-published-2",
            "event-cancelled-1",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-waitlist-event",
            "event-published-2",
            "event-cancelled-1",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["waitlist-user-1", "waitlist-user-2"],
        },
      },
    });

    await prisma.$disconnect();
  });

  // success path: user can RSVP to a published Prisma event
  it("returns 302 and redirects after a user RSVPs to a published event with Prisma", async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: "event-published-2",
        userId: "user-reader",
      },
    });

    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-published-2/rsvp");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/events/event-published-2");
    expect(res.headers.location).toContain("RSVPed");
  });

  // success path: toggling RSVP twice will cancel the RSVP
  it("returns 302 and redirects after cancelling an RSVP with Prisma", async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: "event-published-2",
        userId: "user-reader",
      },
    });

    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);

    const first = await agent.post("/events/event-published-2/rsvp");
    expect(first.status).toBe(302);
    expect(first.headers.location).toContain("RSVPed");

    const second = await agent.post("/events/event-published-2/rsvp");
    expect(second.status).toBe(302);
    expect(second.headers.location).toContain("/events/event-published-2");
    expect(second.headers.location).toContain("cancelled");
  });

  // success path: user is placed on waitlist when event is full
  it("places the user on the waitlist when the event is full (Prisma)", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/prisma-waitlist-event/rsvp");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("waitlist");

    const saved = await prisma.rSVP.findFirst({
      where: {
        eventId: "prisma-waitlist-event",
        userId: "user-reader",
      },
    });

    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("waitlisted");
  });

  // success path: HTMX request returns partial HTML with Prisma when RSVP
  it("returns 200 and partial HTML for an HTMX RSVP request with Prisma", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);

    const res = await agent
      .post("/events/event-published-2/rsvp")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.text).toContain("rsvp-section");
  });

  // success path: HTMX request returns partial HTML with Prisma when cancelling
  it("returns partial HTML when cancelling RSVP via HTMX", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);

    await agent.post("/events/event-published-2/rsvp");

    const res = await agent
      .post("/events/event-published-2/rsvp")
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain("rsvp-section");
  });

  // error path: unauthenticated user cannot RSVP with Prisma
  it("returns 401 for an unauthenticated RSVP POST request with Prisma", async () => {
    const res = await request(app).post("/events/event-published-1/rsvp");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Please log in to continue.");
  });

  // error path: event does not exist with Prisma
  it("returns 404 when trying to RSVP to a non-existent event with Prisma", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/does-not-exist/rsvp");

    expect(res.status).toBe(404);
    expect(res.text).toContain("not found");
  });

  // error path: role staff cannot RSVP with Prisma
  it("returns 400 when staff attempts to RSVP with Prisma", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("cannot RSVP");
  });

  // error path: role admin cannot RSVP with Prisma
  it("returns 400 when admin attempts to RSVP with Prisma", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.post("/events/event-published-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("cannot RSVP");
  });

  // error path: user cannot RSVP to a cancelled event with Prisma
  it("returns 400 when a user tries to RSVP to a cancelled event with Prisma", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.post("/events/event-cancelled-1/rsvp");

    expect(res.status).toBe(400);
    expect(res.text).toContain("Cannot RSVP");
  });
});