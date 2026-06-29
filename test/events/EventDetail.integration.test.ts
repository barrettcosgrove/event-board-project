import request from "supertest";
import { createComposedApp, createComposedAppWithPrisma } from "../../src/composition";
import { loginAs } from "../helper/auth";

const USER_EMAIL = "user@app.test";
const USER_PASSWORD = "password123";

const STAFF_EMAIL = "staff@app.test";
const STAFF_PASSWORD = "password123";

const ADMIN_EMAIL = "admin@app.test";
const ADMIN_PASSWORD = "password123";

describe("Feature 2: Event Detail Page", () => {
  const app = createComposedApp().getExpressApp();
  // success path: published event is visible to logged-in user
  it("returns 200 and renders a published event detail page for a logged-in user", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/event-published-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Spring Picnic");
    expect(res.text).toContain("Campus Pond Lawn");
    expect(res.text).toContain("Food, games, and fun on the lawn.");
    expect(res.text).toContain("Attending");
  });

  // success path: event detail contains required UI fields
  it("renders all required event detail fields in the response body", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/event-published-1");

    expect(res.status).toBe(200);

    expect(res.text).toContain("Spring Picnic");
    expect(res.text).toContain("Food, games, and fun on the lawn.");
    expect(res.text).toContain("Campus Pond Lawn");
    expect(res.text).toContain("party");
    expect(res.text).toContain("Starts");
    expect(res.text).toContain("Ends");
  });

  // success path: role staff can view their own draft
  it("returns 200 when staff views their own draft event", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });

  // success path: role admin can view drafts
  it("returns 200 when admin views a draft event", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });

  // error path: unauthenticated user should be redirected
  it("redirects unauthenticated users to /login", async () => {
    const res = await request(app).get("/events/event-published-1");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  // error path: event does not exist
  it("returns 404 for a non-existent event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.text).toContain("No event exists with the given ID.");
  });

  // error path: role user cannot view drafts
  it("does not allow an individual with role user to view a draft event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(403);
  });
});

describe("Feature 2: Event Detail Page with PrismaEventRepository", () => {
  const app = createComposedAppWithPrisma({usePrismaEvent: true,}).getExpressApp();
  // success path: published event is loaded from Prisma and visible to logged-in user
  it("returns 200 and renders a published event detail page from Prisma", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/event-published-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Spring Picnic");
    expect(res.text).toContain("Campus Pond Lawn");
    expect(res.text).toContain("Food, games, and fun on the lawn.");
    expect(res.text).toContain("Attending");
  });

  // success path: staff can view their own draft loaded from Prisma
  it("returns 200 when staff views their own draft event from Prisma", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });

  // success path: admin can view drafts loaded from Prisma
  it("returns 200 when admin views a draft event from Prisma", async () => {
    const agent = await loginAs(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Draft Planning Meeting");
  });

  // error path: unauthenticated users are redirected to login (Prisma-backed)
  it("redirects unauthenticated users to /login when using Prisma repository", async () => {
    const res = await request(app).get("/events/event-published-1");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });

  // error path: user cannot view draft loaded from Prisma
  it("does not allow an individual with role user to view a draft event from Prisma", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/event-draft-1");

    expect(res.status).toBe(403);
  });

  // error path: staff can't view drafts that they did not create
  it("does not allow staff to view draft events they did not create", async () => {
    const agent = await loginAs(app, STAFF_EMAIL, STAFF_PASSWORD);
    const res = await agent.get("/events/event-draft-admin"); // owned by admin

    expect(res.status).toBe(403);
  });

  // error path: missing Prisma event returns 404
  it("returns 404 for a non-existent Prisma event", async () => {
    const agent = await loginAs(app, USER_EMAIL, USER_PASSWORD);
    const res = await agent.get("/events/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.text).toContain("No event exists with the given ID");
  });
});
