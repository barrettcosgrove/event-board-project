import { Ok } from "../../src/lib/result";
import { CreateEventService } from "../../src/events/EventService";
import { makeEvent, makeEventRepo, makeRsvpRepo } from "../helper/auth";
import type { Event } from "../../src/events/Event";

describe("Feature 8: Event Dashboard Service (Unit)", () => {
    const baseEvents: Event[] = [
        makeEvent({ id: "1", organizerId: "org-1", status: "draft" }),
        makeEvent({ id: "2", organizerId: "org-1", status: "published" }),
        makeEvent({ id: "3", organizerId: "org-2", status: "published" }),
        makeEvent({ id: "4", organizerId: "org-2", status: "cancelled" }),
    ];

    const makeService = (allEvents: Event[]) => {
        const eventRepo = makeEventRepo(Ok(makeEvent()));
        eventRepo.findByOrganizer.mockImplementation(async (userId: string) => {
            return Ok(allEvents.filter(e => e.organizerId === userId));
        });
        eventRepo.findAll.mockResolvedValue(Ok(allEvents));
        const rsvpRepo = makeRsvpRepo();
        return CreateEventService(eventRepo, rsvpRepo);
    };

    it("organizer only sees their own events", async () => {
        const service = makeService(baseEvents);
        const res = await service.getAllEventsForOrganizer("org-1", "staff");

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.map(e => e.id)).toEqual(["1", "2"]);
        }
    });

    it("admin sees all events across organizers", async () => {
        const service = makeService(baseEvents);
        const res = await service.getAllEventsForOrganizer("admin-1", "admin");

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.length).toBe(4);
        }
    });

    it("members are rejected from dashboard service", async () => {
        const service = makeService(baseEvents);
        const res = await service.getAllEventsForOrganizer("user-1", "user");
        expect(res.ok).toBe(false);
    });
});