import { Ok } from "../../src/lib/result";
import type { Result } from "../../src/lib/result";
import { CreateEventService } from "../../src/events/EventService";
import type { Event as AppEvent } from "../../src/events/Event";
import { EventNotFoundError, NotAuthorizedError, InvalidEventStateError} from "../../src/events/errors";
import {
  makeEvent,
  makeEventRepo,
  makeRsvpRepo,
} from "../helper/auth";

describe("Feature 5: EventService.updateEventStatus", () => {
    const makeService = (
        findResult: Result<AppEvent | null, any> = Ok(makeEvent()),
        updateResult: Result<AppEvent, any> = Ok(makeEvent()),
    ) => {
        const eventRepo = makeEventRepo(findResult);
        eventRepo.updateStatus.mockResolvedValue(updateResult);
        const rsvpRepo = makeRsvpRepo();
        return {
        eventRepo,
        service: CreateEventService(eventRepo, rsvpRepo),
        };
    };

  it("allows staff to publish their own draft event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "draft", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "published", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "published",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.value.status).toEqual("published");
    }
  });

  it("allows staff to cancel their own published event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "published", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "cancelled", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "cancelled",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.value.status).toEqual("cancelled");
    }
  });

  it("allows admin to publish any draft event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "draft" })),
        Ok(makeEvent({ status: "published" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-admin",
        "admin",
        "published",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.value.status).toEqual("published");
    }
  });

  it("allows admin to cancel any published event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "published" })),
        Ok(makeEvent({ status: "cancelled" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-admin",
        "admin",
        "cancelled",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.value.status).toEqual("cancelled");
    }
  });

  it("returns EventNotFoundError when the event does not exist", async () => {
    const { service } = makeService(Ok(null));
    const result = await service.updateEventStatus(
        "missing",
        "user-staff",
        "staff",
        "published",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(EventNotFoundError("No event exists with the given ID."));
    }
  });

  it("returns NotAuthorizedError when a user tries to publish a draft event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "draft", organizerId: "someone-else" })),
        Ok(makeEvent({ status: "published", organizerId: "someone-else" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-reader",
        "user",
        "published",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(NotAuthorizedError("You are not authorized to update the event status."));
    }
  });

  it("return NotAuthorizedError when staff tries to publish someone else's draft event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "draft", organizerId: "someone-else" })),
        Ok(makeEvent({ status: "published", organizerId: "someone-else" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "published",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(NotAuthorizedError("You are not authorized to update the event status."));
    }
  });

  it("returns InvalidEventStateError when a staff tries to publish a published event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "published", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "published", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "published",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(InvalidEventStateError("Invalid status transition from \"published\" to \"published\"."));
    }
  });

  it("returns InvalidEventStateError when a staff tries to cancel a cancelled event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "cancelled", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "cancelled", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "cancelled",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(InvalidEventStateError("Invalid status transition from \"cancelled\" to \"cancelled\"."));
    }
  });

  it("returns InvalidEventStateError when a staff tries to publish a cancelled event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "cancelled", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "published", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "published",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(InvalidEventStateError("Invalid status transition from \"cancelled\" to \"published\"."));
    }
  });

  it("returns InvalidEventStateError when a staff tries to cancel a draft event", async () => {
    const { service } = makeService(
        Ok(makeEvent({ status: "draft", organizerId: "user-staff" })),
        Ok(makeEvent({ status: "cancelled", organizerId: "user-staff" })),
    );
    const result = await service.updateEventStatus(
        "event-1",
        "user-staff",
        "staff",
        "cancelled",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.value).toEqual(InvalidEventStateError("Invalid status transition from \"draft\" to \"cancelled\"."));
    }
  });
});
