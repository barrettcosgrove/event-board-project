import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helper/auth";

describe("Feature 7: My RSVP Dashboard", () => {
    const app = createComposedApp().getExpressApp();

    const USER_EMAIL = "user@app.test";
    const STAFF_EMAIL = "staff@app.test";
    const ADMIN_EMAIL = "admin@app.test";
    const PASSWORD = "password123";

    // success: user can access dashboard
    it("renders the RSVP Dashboard for a user", async () => {
        const agent = await loginAs(app, USER_EMAIL, PASSWORD);
        const res = await agent.get("/rsvps");

        expect(res.status).toBe(200);
        expect(res.text).toContain("My RSVPs");
        expect(res.text).toContain("Upcoming Events");
        expect(res.text).toMatch(/Past .*Cancelled/);
    });

    // error: staff cannot access
    it("returns 403 when a staff user tries to access the dashboard", async () => {
        const agent = await loginAs(app, STAFF_EMAIL, PASSWORD);
        const res = await agent.get("/rsvps");

        expect(res.status).toBe(403);
        expect(res.text).toContain("Only members can access");
    });

    // error: admin cannot access
    it("returns 403 when an admin tries to access the dashboard", async () => {
        const agent = await loginAs(app, ADMIN_EMAIL, PASSWORD);
        const res = await agent.get("/rsvps");

        expect(res.status).toBe(403);
        expect(res.text).toContain("Only members can access");
    });

    // error: unauthenticated use
    it("returns 302 when not logged in an redirects to login", async () => {
        const res = await request(app).get("/rsvps");

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/login"); // redirect to login
    })

    // HTMX cancel flow
    it("returns partial HTMX when cancelling RSVP via HTMX", async () => {
        const agent = await loginAs(app, USER_EMAIL, PASSWORD);
        const res = await agent
            .post("/events/event-published-1/rsvp")
            .set("HX-Request", "true");

        expect(res.status).toBe(200);
        expect(res.text).toContain("rsvp");
    })
})