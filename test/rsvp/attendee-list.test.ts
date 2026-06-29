import { Ok } from "../../src/lib/result";
import { CreateRsvpService } from "../../src/rsvp/RsvpService";
import { EventNotFoundError, NotAuthorizedError } from "../../src/rsvp/errors";
import type { RSVPAttendee } from "../../src/rsvp/RSVP";
import type { ILoggingService } from "../../src/service/LoggingService";
import {
  makeEvent,
  makeEventRepo,
  makeRsvpRepo,
} from "../helper/auth";

function makeAttendee(overrides: Partial<RSVPAttendee> = {}): RSVPAttendee {
  return {
    id: "rsvp-1",
    eventId: "event-1",
    userId: "user-1",
    displayName: "Una User",
    status: "going",
    createdAt: new Date("2099-06-01T10:00:00.000Z"),
    ...overrides,
  };
}

function makeLogger(): jest.Mocked<ILoggingService> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe("Feature 12 Sprint 2 - Attendee List unit", () => {
  it("groups attendee RSVPs into going, waitlisted, and cancelled", async () => {
    const rsvpRepo = makeRsvpRepo();

    rsvpRepo.findAttendeesByEventId.mockResolvedValue(
      Ok([
        makeAttendee({ id: "rsvp-going", status: "going" }),
        makeAttendee({ id: "rsvp-waitlisted", status: "waitlisted" }),
        makeAttendee({ id: "rsvp-cancelled", status: "cancelled" }),
      ]),
    );

    const service = CreateRsvpService(
      rsvpRepo,
      makeEventRepo(Ok(makeEvent())),
      makeLogger(),
    );

    const result = await service.getRSVPsByEvent(
      "event-1",
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.going).toHaveLength(1);
    expect(result.value.waitlisted).toHaveLength(1);
    expect(result.value.cancelled).toHaveLength(1);
  });

  it("returns NotAuthorizedError when a member requests attendee list", async () => {
    const service = CreateRsvpService(
      makeRsvpRepo(),
      makeEventRepo(Ok(makeEvent())),
      makeLogger(),
    );

    const result = await service.getRSVPsByEvent("event-1", "user-1", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(NotAuthorizedError("Users cannot view attendee lists"));
  });

  it("returns EventNotFoundError for a missing event", async () => {
    const service = CreateRsvpService(
      makeRsvpRepo(),
      makeEventRepo(Ok(null)),
      makeLogger(),
    );

    const result = await service.getRSVPsByEvent("missing-event", "admin-1", "admin");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(EventNotFoundError("Event missing-event not found"));
  });
});
