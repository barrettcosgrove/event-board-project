import { Ok } from "../../src/lib/result";
import { CreateRsvpService } from "../../src/rsvp/RsvpService";
import type { RSVPWithEvent } from "../../src/rsvp/RSVP";
import {
    makeEvent,
    makeEventRepo,
    makeLogger,
    makeRsvpRepo,
} from "../helper/auth";

describe("Feature 7: getRSVPsByUser (Dashboard)", () => {
    const makeRSVPWithEvent = (
        overrides: Partial<RSVPWithEvent> = {},
    ): RSVPWithEvent => ({
        id: "r1",
        eventId: "e1",
        userId: "user-1",
        status: "going",
        createdAt: new Date("2025-01-01"),
        event: makeEvent(),
        ...overrides,
    });

    it("returns RSVPs sorted by createdAt descending", async () => {
        const rsvps = [
            makeRSVPWithEvent({ id: "old", createdAt: new Date("2020-01-01") }),
            makeRSVPWithEvent({ id: "new", createdAt: new Date("2030-01-01") }),
        ]
        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));

        const service = CreateRsvpService(
            rsvpRepo,
            makeEventRepo(),
            makeLogger(),
        );

        const result = await service.getRSVPsByUser("user-1");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value[0].id).toBe("new");
        expect(result.value[1].id).toBe("old");
    });

    it("returns empty array when user has no RSVPs", async () => {
        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok([]));

        const service = CreateRsvpService(
            rsvpRepo,
            makeEventRepo(),
            makeLogger(),
        );

        const result = await service.getRSVPsByUser("user-1");
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual([]);
    });
})

describe("Feature 7: getDashboardRSVPs (unit)", () => {
    const makeRSVP = (overrides: Partial<RSVPWithEvent> = {}): RSVPWithEvent => ({
        id: "r1",
        eventId: "e1",
        userId: "user-1",
        status: "going",
        createdAt: new Date("2025-01-01"),
        event: makeEvent(),
        ...overrides,
    });

    it("splits RSVPs into upcoming and past/cancelled", async () => {
        const now = new Date();

        const rsvps: RSVPWithEvent[] = [
            makeRSVP({
                id: "upcoming",
                status: "going",
                createdAt: new Date("2025-01-01"),
                event: makeEvent({
                    startDatetime: new Date(now.getTime() + 100000), // future
                }),
            }),
            makeRSVP({
                id: "past",
                status: "going",
                createdAt: new Date("2024-01-01"),
                event: makeEvent({
                    startDatetime: new Date(now.getTime() - 100000), // past
                }),
            }),
            makeRSVP({
                id: "cancelled",
                status: "cancelled",
                createdAt: new Date("2026-01-01"),
                event: makeEvent({
                    startDatetime: new Date(now.getTime() + 200000),
                }),
            }),
        ];
        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));

        const service = CreateRsvpService(
            rsvpRepo,
            makeEventRepo(),
            makeLogger(),
        );

        const result = await service.getDashboardRSVPs("user-1");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.upcoming.length).toBe(1);
        expect(result.value.pastCancelled.length).toBe(2);
    });

    it("sorts upcoming ascending by createdAt", async () => {
        const now = new Date();

        const rsvps: RSVPWithEvent[] = [
            makeRSVP({
                id: "new",
                createdAt: new Date("2030-01-01"),
                event: makeEvent({ startDatetime: new Date(now.getTime() + 10000) }),
            }),
            makeRSVP({
                id: "old",
                createdAt: new Date("2020-01-01"),
                event: makeEvent({ startDatetime: new Date(now.getTime() + 10000) }),
            }),
        ];

        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));

        const service = CreateRsvpService(
            rsvpRepo,
            makeEventRepo(),
            makeLogger(),
        );

        const result = await service.getDashboardRSVPs("user-1");
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.upcoming[0].id).toBe("new");
        expect(result.value.upcoming[1].id).toBe("old");
    });

    it("sorts pastCancelled descending by createdAt", async () => {
        const now = new Date();

        const rsvps: RSVPWithEvent[] = [
            makeRSVP({
                id: "new",
                createdAt: new Date("2030-01-01"),
                status: "cancelled",
                event: makeEvent({ startDatetime: new Date(now.getTime() - 10000) }),
            }),
            makeRSVP({
                id: "old",
                createdAt: new Date("2020-01-01"),
                status: "going",
                event: makeEvent({ startDatetime: new Date(now.getTime() - 10000) }),
            }),
        ];

        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));

        const service = CreateRsvpService(
            rsvpRepo,
            makeEventRepo(),
            makeLogger(),
        );
        const result = await service.getDashboardRSVPs("user-1");

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.pastCancelled[0].id).toBe("new");
        expect(result.value.pastCancelled[1].id).toBe("old");
    });

    it("includes conflictWarning on upcoming RSVPs that overlap with another event", async () => {
        const now = new Date();
        const futureEvent = makeEvent({
            startDatetime: new Date(now.getTime() + 100000),
            endDatetime: new Date(now.getTime() + 200000),
        });
    
        const rsvps: RSVPWithEvent[] = [
            makeRSVP({
                id: "upcoming-conflict",
                status: "going",
                event: futureEvent,
            }),
        ];
    
        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));
        rsvpRepo.findOverlappingActiveRsvps.mockResolvedValue(Ok([
            {
                id: "conflict-rsvp",
                eventId: "conflict-event",
                userId: "user-1",
                status: "going" as const,
                createdAt: new Date(),
                event: makeEvent({ title: "Overlapping Seminar" }),
            }
        ]));
    
        const service = CreateRsvpService(rsvpRepo, makeEventRepo(), makeLogger());
        const result = await service.getDashboardRSVPs("user-1");
    
        expect(result.ok).toBe(true);
        if (!result.ok) return;
    
        expect(result.value.upcoming.length).toBe(1);
        expect(result.value.upcoming[0].conflictWarning).toBe("Conflicts with Overlapping Seminar");
    });
    
    it("sets conflictWarning to null on upcoming RSVPs with no overlaps", async () => {
        const now = new Date();
        const futureEvent = makeEvent({
            startDatetime: new Date(now.getTime() + 100000),
            endDatetime: new Date(now.getTime() + 200000),
        });
    
        const rsvps: RSVPWithEvent[] = [
            makeRSVP({
                id: "upcoming-no-conflict",
                status: "going",
                event: futureEvent,
            }),
        ];
    
        const rsvpRepo = makeRsvpRepo();
        rsvpRepo.findByUser.mockResolvedValue(Ok(rsvps));
        rsvpRepo.findOverlappingActiveRsvps.mockResolvedValue(Ok([]));
    
        const service = CreateRsvpService(rsvpRepo, makeEventRepo(), makeLogger());
        const result = await service.getDashboardRSVPs("user-1");
    
        expect(result.ok).toBe(true);
        if (!result.ok) return;
    
        expect(result.value.upcoming.length).toBe(1);
        expect(result.value.upcoming[0].conflictWarning).toBeNull();
    });
})