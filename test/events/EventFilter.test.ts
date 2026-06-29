import { Ok } from "../../src/lib/result";
import { CreateEventService } from "../../src/events/EventService";
import { Event } from "../../src/events/Event";
import { IEventRepository } from "../../src/events/EventRepository";
import { makeEvent as authMakeEvent, makeRsvpRepo } from "../helper/auth";

describe("Feature 6: EventService.listEvents", () => {
    const now = new Date();
    const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inOneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const inOneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const inFortyDays = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
    const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const oneHour = 60 * 60 * 1000;

    const makeEvent = (overrides: Partial<Event> = {}): Event =>
        authMakeEvent({
            title: "Test Event",
            description: "A test event description",
            location: "Amherst, MA",
            category: "technology",
            capacity: 50,
            startDatetime: inFiveDays,
            endDatetime: new Date(inFiveDays.getTime() + oneHour),
            ...overrides,
        });

    function makeEventRepo(events: Event[] = [makeEvent()]): jest.Mocked<IEventRepository> {
        return {
            findById: jest.fn(),
            findByOrganizer: jest.fn(),
            findAll: jest.fn().mockResolvedValue(Ok(events)),
            findPublishedUpcoming: jest.fn().mockResolvedValue(Ok(events.filter(e => e.status === "published" && e.startDatetime > now))),
            create: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
        };
    }

    it("returns all published upcoming events by default", async () => {
        const events = [
            makeEvent({id: "e1", status: "published"}),
            makeEvent({id: "e2", status: "published"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(2);
        }
    });

    it("return an empty array for an empty event list", async () => {
        const service = CreateEventService(makeEventRepo([]), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(0);
        }
    });

    it("return an empty array for a non-published event if user role is user", async () => {
        const events = [
            makeEvent({id: "e1", status: "draft"}),
            makeEvent({id: "e2", status: "draft"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(0);
        }
    });

    it("shows staff their own drafts alongside published upcoming events", async () => {
        const events = [
            makeEvent({id: "e1", status: "published"}),
            makeEvent({id: "e2", status: "draft"}),
            makeEvent({id: "e3", status: "draft"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-staff", "staff", {});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(3);
        }
    });

    it("admin sees all events, including drafts, and cancelled events", async () => {
        const events = [
            makeEvent({id: "e1", status: "published"}),
            makeEvent({id: "e2", status: "draft"}),
            makeEvent({id: "e3", status: "draft"}),
            makeEvent({id: "e4", status: "cancelled"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-admin", "admin", {});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(4);
        }
    });

    it("filter by a valid category", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", category: "technology"}),
            makeEvent({id: "e2", status: "published", category: "business"}),
            makeEvent({id: "e3", status: "published", category: "music"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "technology"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(1);
            expect(result.value[0].id).toBe("e1");
        }
    });

    it("return an empty array when no event matches the category filter", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", category: "technology"}),
            makeEvent({id: "e2", status: "published", category: "business"}),
            makeEvent({id: "e3", status: "published", category: "music"}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "art"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(0);
        }
    });

    it("filter by a all upcoming timeframe", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", startDatetime: inOneDay}),
            makeEvent({id: "e2", status: "published", startDatetime: inFiveDays}),
            makeEvent({id: "e3", status: "published", startDatetime: inFortyDays}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "all"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(3);
        }
    });

    it("filter by a this week timeframe", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", startDatetime: inOneDay}),
            makeEvent({id: "e2", status: "published", startDatetime: inFiveDays}),
            makeEvent({id: "e3", status: "published", startDatetime: inFortyDays}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "this_week"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(2);
            expect(result.value.map(e => e.id)).toEqual(["e1", "e2"]);
        }
    });

    it("filter by a this month timeframe", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", startDatetime: inOneDay}),
            makeEvent({id: "e2", status: "published", startDatetime: inOneWeek}),
            makeEvent({id: "e3", status: "published", startDatetime: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000)}),
            makeEvent({id: "e5", status: "published", startDatetime: inFortyDays}),
            makeEvent({id: "e6", status: "published", startDatetime: inOneYear}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "this_month"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(3);
            expect(result.value.map(e => e.id)).toEqual(["e1", "e2", "e3"]);
        }
    });

    it("filter by a this year timeframe", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", startDatetime: inOneDay}),
            makeEvent({id: "e2", status: "published", startDatetime: inOneWeek}),
            makeEvent({id: "e3", status: "published", startDatetime: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000)}),
            makeEvent({id: "e4", status: "published", startDatetime: inOneMonth}),
            makeEvent({id: "e5", status: "published", startDatetime: inFortyDays}),
            makeEvent({id: "e7", status: "published", startDatetime: new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000)}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "this_year"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(5);
            expect(result.value.map(e => e.id)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
        }
    });

    it("return an empty array when no event matches the timeframe filter", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", startDatetime: new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000)}),
            makeEvent({id: "e2", status: "published", startDatetime: new Date(now.getTime() + 367 * 24 * 60 * 60 * 1000)}),
            makeEvent({id: "e3", status: "published", startDatetime: new Date(now.getTime() + 368 * 24 * 60 * 60 * 1000)}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "this_year"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(0);
        }
    });

    it("filters by both category and timeframe", async () => {
        const events = [
            makeEvent({id: "e1", status: "published", category: "technology", startDatetime: inOneDay}),
            makeEvent({id: "e2", status: "published", category: "technology", startDatetime: inFiveDays}),
            makeEvent({id: "e3", status: "published", category: "technology", startDatetime: inFortyDays}),
            makeEvent({id: "e4", status: "published", category: "business", startDatetime: inOneDay}),
            makeEvent({id: "e5", status: "published", category: "business", startDatetime: inFiveDays}),
            makeEvent({id: "e6", status: "published", category: "business", startDatetime: inFortyDays}),
        ];
        const service = CreateEventService(makeEventRepo(events), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "technology", timeframe: "this_week"});
        expect(result.ok).toBe(true);
        if (result.ok){
            expect(result.value.length).toBe(2);
            expect(result.value.map(e => e.id)).toEqual(["e1", "e2"]);
        }
    });

    it("return InvalidInputError when category is invalid", async () => {
        const service = CreateEventService(makeEventRepo(), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "invalid" as any});
        expect(result.ok).toBe(false);
        if (!result.ok){
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("returns InvalidInputError when timeframe is invalid", async () => {
        const service = CreateEventService(makeEventRepo(), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {timeframe: "invalid" as any});
        expect(result.ok).toBe(false);
        if (!result.ok){
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("returns InvalidInputError when category and timeframe are invalid", async () => {
        const service = CreateEventService(makeEventRepo(), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "invalid" as any, timeframe: "invalid" as any});
        expect(result.ok).toBe(false);
        if (!result.ok){
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("return InvalidInputError when category is valid and timeframe is invalid", async () => {
        const service = CreateEventService(makeEventRepo(), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "technology", timeframe: "invalid" as any});
        expect(result.ok).toBe(false);
        if (!result.ok){
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("return InvalidInputError when category is invalid and timeframe is valid", async () => {
        const service = CreateEventService(makeEventRepo(), makeRsvpRepo());
        const result = await service.listEvents("user-reader", "user", {category: "invalid" as any, timeframe: "this_week"});
        expect(result.ok).toBe(false);
        if (!result.ok){
            expect(result.value.name).toBe("InvalidInputError");
        }
    }); 
});