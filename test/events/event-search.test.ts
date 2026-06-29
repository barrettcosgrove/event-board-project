import { Ok } from "../../src/lib/result";
import { CreateEventService } from "../../src/events/EventService";
import { InvalidSearchQueryError } from "../../src/events/errors";
import {
  makeEvent,
  makeEventRepo,
  makeRsvpRepo,
} from "../helper/auth";

describe("Feature 10 Sprint 2 - Event Search unit", () => {
  it("matches published upcoming events case-insensitively across searchable fields", async () => {
    const events = [
      makeEvent({ id: "event-match", title: "Case Insensitive Event" }),
      makeEvent({ id: "event-other", title: "Another Event", location: "Library" }),
    ];

    const eventRepo = makeEventRepo();
    eventRepo.findAll.mockResolvedValue(Ok(events));
    eventRepo.findPublishedUpcoming.mockResolvedValue(Ok(events));

    const service = CreateEventService(eventRepo, makeRsvpRepo());

    const result = await service.listEvents("user-1", "user", {
      searchQuery: "cAsE inSENsItive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0].id).toBe("event-match");
  });

  it("returns all visible published upcoming events for an empty query", async () => {
    const events = [
      makeEvent({ id: "event-published-future" }),
      makeEvent({ id: "event-past", startDatetime: new Date("2000-01-01T00:00:00.000Z") }),
      makeEvent({ id: "event-draft", status: "draft" }),
    ];

    const eventRepo = makeEventRepo();
    eventRepo.findAll.mockResolvedValue(Ok(events));
    eventRepo.findPublishedUpcoming.mockResolvedValue(Ok(events));

    const service = CreateEventService(eventRepo, makeRsvpRepo());

    const result = await service.listEvents("user-1", "user", { searchQuery: "   " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.map((event) => event.id)).toEqual(["event-published-future"]);
  });

  it("returns no results when no events match the search query", async () => {
    const events = [
      makeEvent({ id: "event-one", title: "Spring Picnic", location: "Campus Green" }),
      makeEvent({ id: "event-two", title: "Night Study Session", location: "Library" }),
    ];

    const eventRepo = makeEventRepo();
    eventRepo.findAll.mockResolvedValue(Ok(events));
    eventRepo.findPublishedUpcoming.mockResolvedValue(Ok(events));

    const service = CreateEventService(eventRepo, makeRsvpRepo());

    const result = await service.listEvents("user-1", "user", { searchQuery: "zebra" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(0);
  });

  it("returns InvalidSearchQueryError when search query exceeds maximum length", async () => {
    const service = CreateEventService(makeEventRepo(), makeRsvpRepo());

    const result = await service.listEvents("user-1", "user", {
      searchQuery: "x".repeat(101),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidSearchQueryError("Search query must be 100 characters or fewer."),
    );
  });

  it("adds conflict warning metadata for RSVP'd events with overlaps", async () => {
    const events = [
      makeEvent({
        id: "event-match",
        title: "Conflict Event",
        startDatetime: new Date("2030-04-20T15:00:00.000Z"),
        endDatetime: new Date("2030-04-20T17:00:00.000Z"),
      }),
    ];

    const eventRepo = makeEventRepo();
    eventRepo.findAll.mockResolvedValue(Ok(events));
    eventRepo.findPublishedUpcoming.mockResolvedValue(Ok(events));

    const rsvpRepo = makeRsvpRepo();
    rsvpRepo.findByUser.mockResolvedValue(
      Ok([
        {
          id: "rsvp-1",
          eventId: "event-match",
          userId: "user-1",
          status: "going",
          createdAt: new Date(),
        },
      ]),
    );
    rsvpRepo.findOverlappingActiveRsvps.mockResolvedValue(
      Ok([
        {
          id: "rsvp-overlap",
          eventId: "event-overlap",
          userId: "user-1",
          status: "going",
          createdAt: new Date(),
          event: makeEvent({ id: "event-overlap", title: "Overlap Event" }),
        },
      ]),
    );

    const service = CreateEventService(eventRepo, rsvpRepo);
    const result = await service.listEvents("user-1", "user", { searchQuery: "conflict" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0].conflictWarning).toBe("Conflicts with Overlap Event");
  });
});
