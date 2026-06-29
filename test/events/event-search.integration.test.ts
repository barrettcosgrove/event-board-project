import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helper/auth";

type LoggedInAgent = Awaited<ReturnType<typeof loginAs>>;

async function createAndPublishEvent(
  staffAgent: LoggedInAgent,
  title: string,
): Promise<string> {
  const createResponse = await staffAgent
    .post("/events/new")
    .type("form")
    .send({
      title,
      description: "Integration test event for search.",
      location: "Engineering Hall",
      category: "technology",
      capacity: "25",
      startDatetime: "2099-06-15T18:00",
      endDatetime: "2099-06-15T20:00",
    });

  expect(createResponse.status).toBe(302);

  const locationHeader = createResponse.header.location as string;
  const idMatch = locationHeader.match(/^\/events\/([^/]+)$/);
  expect(idMatch).not.toBeNull();

  const eventId = idMatch![1];
  const publishResponse = await staffAgent.post(`/events/${eventId}/publish`);
  expect(publishResponse.status).toBe(302);

  return eventId;
}

describe("Feature 10 Sprint 2 - Event Search integration", () => {
  it("redirects unauthenticated users to login when accessing event search route", async () => {
    const app = createComposedApp().getExpressApp();

    const response = await request(app)
      .get("/events")
      .query({ searchQuery: "spring" });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("returns matching results for a valid search query", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const uniqueTitle = "Search Match Sprint Two Event";
    await createAndPublishEvent(staffAgent, uniqueTitle);

    const response = await userAgent.get("/events").query({ searchQuery: "sprint two event" });

    expect(response.status).toBe(200);
    expect(response.text).toContain(uniqueTitle);
  });

  it("returns no-results state when query has no matches", async () => {
    const app = createComposedApp().getExpressApp();
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const response = await userAgent
      .get("/events")
      .query({ searchQuery: "no-match-abcxyz-12345" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("No events found.");
  });

  it("treats an empty query as all published upcoming events", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const uniqueTitle = "Empty Query All Events Case";
    await createAndPublishEvent(staffAgent, uniqueTitle);

    const response = await userAgent.get("/events").query({ searchQuery: "   " });

    expect(response.status).toBe(200);
    expect(response.text).toContain(uniqueTitle);
  });

  it("matches events by location text", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const uniqueTitle = "Location Match Sprint Two Event";
    await createAndPublishEvent(staffAgent, uniqueTitle);

    const response = await userAgent.get("/events").query({ searchQuery: "engineering hall" });

    expect(response.status).toBe(200);
    expect(response.text).toContain(uniqueTitle);
  });

  it("matches search queries case-insensitively", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const uniqueTitle = "Case Insensitive Query Event";
    await createAndPublishEvent(staffAgent, uniqueTitle);

    const response = await userAgent.get("/events").query({ searchQuery: "cAsE inSenSitiVe" });

    expect(response.status).toBe(200);
    expect(response.text).toContain(uniqueTitle);
  });

  it("returns 400 for an invalid search query that exceeds max length", async () => {
    const app = createComposedApp().getExpressApp();
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const response = await userAgent
      .get("/events")
      .query({ searchQuery: "x".repeat(101) });

    expect(response.status).toBe(400);
    expect(response.text).toContain("Search query must be 100 characters or fewer.");
  });

  it("returns an HTMX partial (not full page) for an HTMX search request", async () => {
    const app = createComposedApp().getExpressApp();
    const staffAgent = await loginAs(app, "staff@app.test", "password123");
    const userAgent = await loginAs(app, "user@app.test", "password123");

    const uniqueTitle = "HTMX Partial Search Event";
    await createAndPublishEvent(staffAgent, uniqueTitle);

    const response = await userAgent
      .get("/events")
      .set("HX-Request", "true")
      .query({ searchQuery: "htmx partial" });

    expect(response.status).toBe(200);
    expect(response.text).toContain(uniqueTitle);
    expect(response.text.toLowerCase()).not.toContain("<!doctype html>");
    expect(response.text.toLowerCase()).not.toContain("<html");
  });
});
