import { createComposedApp } from "../../src/composition";
import request from "supertest";
import { loginAs } from "../helper/auth";

describe("Feature 12 Sprint 2 - Attendee List integration", () => {
  it("allows staff organizer to view attendee list for their own event", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text).toContain("Going");
    expect(response.text).toContain("Waitlisted");
    expect(response.text).toContain("Cancelled");
  });

  it("shows attendee display names in attendee rows", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Una User");
    expect(response.text).toContain("Avery Admin");
    expect(response.text).toContain("Sam Staff");
  });

  it("returns attendees sorted by createdAt ascending within each group", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);

    const goingSectionMatch = response.text.match(/<h2 class="text-xl font-semibold text-slate-900 mb-3">Going<\/h2>([\s\S]*?)<\/section>/);
    expect(goingSectionMatch).not.toBeNull();

    const goingSection = goingSectionMatch![1];
    const unaUserPosition = goingSection.indexOf("Una User");
    const samStaffPosition = goingSection.indexOf("Sam Staff");

    expect(unaUserPosition).toBeGreaterThanOrEqual(0);
    expect(samStaffPosition).toBeGreaterThanOrEqual(0);
    expect(unaUserPosition).toBeLessThan(samStaffPosition);
  });

  it("allows admin to view attendee list for any event", async () => {
    const app = createComposedApp().getExpressApp();
    const adminAgent = await loginAs(app, "admin@app.test", "password123");

    const response = await adminAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
  });

  it("rejects member access to attendee list with 403", async () => {
    const app = createComposedApp().getExpressApp();
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const response = await userAgent.get("/events/event-published-1/attendees");

    expect(response.status).toBe(403);
    expect(response.text).toContain("Users cannot view attendee lists");
  });

  it("redirects unauthenticated requests to login", async () => {
    const app = createComposedApp().getExpressApp();

    const response = await request(app).get("/events/event-published-1/attendees");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("rejects staff access to events they do not own with 403", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent.get("/events/event-published-2/attendees");

    expect(response.status).toBe(403);
    expect(response.text).toContain("Staff can only view attendees for their own events");
  });

  it("returns 404 when requesting attendee list for a missing event", async () => {
    const app = createComposedApp().getExpressApp();
    const adminAgent = await loginAs(app, "admin@app.test", "password123");

    const response = await adminAgent.get("/events/does-not-exist/attendees");

    expect(response.status).toBe(404);
    expect(response.text).toContain("Event does-not-exist not found");
  });

  it("returns an HTMX partial attendee list when HX-Request is true", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");

    const response = await staffAgent
      .get("/events/event-published-1/attendees")
      .set("HX-Request", "true");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Attendee List");
    expect(response.text.toLowerCase()).not.toContain("<!doctype html>");
    expect(response.text.toLowerCase()).not.toContain("<html");
  });
});
