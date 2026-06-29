import request from "supertest";
import type { Express } from "express";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helper/auth";

describe("Feature 8: Organizer Dashboard (Integration)", () => {
    let app: Express;

    beforeEach(() => {
        app = createComposedApp().getExpressApp();
    });

    const STAFF_EMAIL = "staff@app.test";
    const ADMIN_EMAIL = "admin@app.test";
    const USER_EMAIL = "user@app.test";
    const PASSWORD = "password123";

    it("redirects unauthenticated users", async () => {
        const res = await request(app).get("/events/dashboard");
        expect(res.status).toBe(302);
    });

    it("rejects normal users", async () => {
        const agent = await loginAs(app, USER_EMAIL, PASSWORD);
        const res = await agent.get("/events/dashboard");
        expect(res.status).toBe(403);
    });

    it("organizer sees dashboard grouping", async () => {
        const agent = await loginAs(app, STAFF_EMAIL, PASSWORD);
        const res = await agent.get("/events/dashboard");
        expect(res.status).toBe(200);
        expect(res.text).toContain("published");
        expect(res.text).toContain("draft");
        expect(res.text).toContain("cancelled");
    });

    it("admin sees full dashboard", async () => {
        const agent = await loginAs(app, ADMIN_EMAIL, PASSWORD);
        const res = await agent.get("/events/dashboard");
        expect(res.status).toBe(200);
        expect(res.text).toContain("published");
    });

    it("HTMX publish returns partial response", async () => {
        const agent = await loginAs(app, STAFF_EMAIL, PASSWORD);
        const res = await agent
            .post("/events/event-draft-1/publish")
            .set("HX-Request", "true");

        expect(res.status).toBe(200);
        expect(res.text).not.toContain("<html");
        expect(res.text).toContain("Cancel Event");
        expect(res.text).not.toContain("Publish Event");
    });

    it("HTMX cancel returns partial response", async () => {
        const agent = await loginAs(app, STAFF_EMAIL, PASSWORD);
        const res = await agent
            .post("/events/event-published-1/cancel")
            .set("HX-Request", "true");

        expect(res.status).toBe(200);
        expect(res.text).not.toContain("<html");
        expect(res.text).toContain("This event is cancelled.");
        expect(res.text).not.toContain("Cancel Event");
        expect(res.text).not.toContain("Publish Event");
    });
});