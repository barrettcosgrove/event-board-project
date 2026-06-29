import { Ok, Err } from "../../src/lib/result";
import { CreateRsvpService } from "../../src/rsvp/RsvpService";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaEventRepository } from "../../src/events/PrismaEventRepository";
import { PrismaRsvpRepository } from "../../src/rsvp/PrismaRsvpRepository";
import {
  EventNotFoundError,
  InvalidRSVPError,
  UnexpectedDependencyError,
} from "../../src/rsvp/errors";
import type { RSVP } from "../../src/rsvp/RSVP";
import {
  makeEvent,
  makeEventRepo,
  makeRsvpRepo,
  makeLogger,
} from "../helper/auth";

describe("Feature 4: RsvpService.toggleRSVP", () => {

  const makeRsvp = (overrides: Partial<RSVP> = {}): RSVP => ({
    id: "rsvp-1",
    eventId: "event-1",
    userId: "user-reader",
    status: "going",
    createdAt: new Date("2099-04-01T10:00:00.000Z"),
    ...overrides,
  });

  // success path: not RSVP'd + space available -> going
  it("returns a going RSVP when the user has no existing RSVP and the event has capacity", async () => {
    const eventRepo = makeEventRepo(
      Ok(makeEvent({ capacity: 10 })),
    );
    const rsvpRepo = makeRsvpRepo(Ok(2));
    rsvpRepo.findByUserAndEvent.mockResolvedValue(Ok(null));
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("going");
    expect(result.value.rsvp.eventId).toBe("event-1");
    expect(result.value.rsvp.userId).toBe("user-reader");
    expect(rsvpRepo.save).toHaveBeenCalled();
  });

  // success path: no existing RSVP + event full capacity -> waitlisted
  it("returns a waitlisted RSVP when the event is full", async () => {
    const eventRepo = makeEventRepo(
      Ok(makeEvent({ capacity: 2 })),
    );
    const rsvpRepo = makeRsvpRepo(Ok(2));
    rsvpRepo.findByUserAndEvent.mockResolvedValue(Ok(null));
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("waitlisted");
    expect(rsvpRepo.save).toHaveBeenCalled();
  });

  // success path: existing active RSVP -> cancelled
  it("cancels an existing going RSVP when the user toggles again", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo();
    rsvpRepo.findByUserAndEvent.mockResolvedValue(
      Ok(makeRsvp({ status: "going" })),
    );
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("cancelled");
    expect(result.value.rsvp.id).toBe("rsvp-1");
    expect(rsvpRepo.save).toHaveBeenCalled();
  });

  // success path: existing waitlisted RSVP -> cancelled
  it("cancels an existing waitlisted RSVP when the user toggles again", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo();
    rsvpRepo.findByUserAndEvent.mockResolvedValue(
      Ok(makeRsvp({ status: "waitlisted" })),
    );
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("cancelled");
    expect(rsvpRepo.save).toHaveBeenCalled();
  });

  // error path: staff/admin cannot RSVP
  it("returns InvalidRSVPError when a staff user attempts to RSVP", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo();
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-staff", "staff");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidRSVPError("Organizers and admins cannot RSVP to events"),
    );
  });

  // error path: event does not exist
  it("returns EventNotFoundError when the event does not exist", async () => {
    const eventRepo = makeEventRepo(Ok(null));
    const rsvpRepo = makeRsvpRepo();
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("missing-event", "user-reader", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      EventNotFoundError("Event missing-event not found"),
    );
  });

  // error path: cancelled event
  it("returns InvalidRSVPError when the event is cancelled", async () => {
    const eventRepo = makeEventRepo(
      Ok(makeEvent({ status: "cancelled" })),
    );
    const rsvpRepo = makeRsvpRepo();
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidRSVPError("Cannot RSVP to a cancelled or past event"),
    );
  });

  // error path: past event
  it("returns InvalidRSVPError when the event is past", async () => {
    const eventRepo = makeEventRepo(
      Ok(makeEvent({ status: "past" })),
    );
    const rsvpRepo = makeRsvpRepo();
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidRSVPError("Cannot RSVP to a cancelled or past event"),
    );
  });

  // error path: existing RSVP lookup fails
  it("propagates RSVP repository errors when existing RSVP lookup fails", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo();
    rsvpRepo.findByUserAndEvent.mockResolvedValue(
      Err(UnexpectedDependencyError("Unable to look up RSVP.")),
    );
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      UnexpectedDependencyError("Unable to look up RSVP."),
    );
  });

  // error path: countGoing fails during capacity check
  it("propagates RSVP repository errors when attendee counting fails", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo();
    rsvpRepo.findByUserAndEvent.mockResolvedValue(Ok(null));
    rsvpRepo.countGoing.mockResolvedValue(
      Err(UnexpectedDependencyError("Unable to count attendees.")),
    );
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      UnexpectedDependencyError("Unable to count attendees."),
    );
  });

  it("returns conflicts when user RSVPs to an event overlapping an existing RSVP", async () => {
    const eventRepo = makeEventRepo(
        Ok(makeEvent({ capacity: 10 })),
    );
    const rsvpRepo = makeRsvpRepo(Ok(2));
    rsvpRepo.findByUserAndEvent.mockResolvedValue(Ok(null));
    rsvpRepo.findOverlappingActiveRsvps.mockResolvedValue(Ok([
        {
            id: "conflict-rsvp-1",
            eventId: "event-conflict-1",
            userId: "user-reader",
            status: "going" as const,
            createdAt: new Date(),
            event: makeEvent({ id: "event-conflict-1", title: "Morning Workshop" }),
        }
    ]));
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);
    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("going");
    expect(result.value.conflicts.length).toBe(1);
    expect(result.value.conflicts[0].event.title).toBe("Morning Workshop");
});

it("returns empty conflicts array when there are no overlapping RSVPs", async () => {
    const eventRepo = makeEventRepo(
        Ok(makeEvent({ capacity: 10 })),
    );
    const rsvpRepo = makeRsvpRepo(Ok(2));
    rsvpRepo.findByUserAndEvent.mockResolvedValue(Ok(null));
    rsvpRepo.findOverlappingActiveRsvps.mockResolvedValue(Ok([]));
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);
    const result = await service.toggleRSVP("event-1", "user-reader", "user");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("going");
    expect(result.value.conflicts.length).toBe(0);
  });
});

describe("Feature 4: RsvpService.toggleRSVP with Prisma", () => {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
  });

  const prisma = new PrismaClient({ adapter });

  beforeEach(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: {
          in: [
            "prisma-rsvp-open-event",
            "prisma-rsvp-full-event",
            "prisma-rsvp-toggle-event",
            "prisma-rsvp-cancelled-event",
            "prisma-rsvp-past-event",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-rsvp-open-event",
            "prisma-rsvp-full-event",
            "prisma-rsvp-toggle-event",
            "prisma-rsvp-cancelled-event",
            "prisma-rsvp-past-event",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["user-going-1", "user-going-2"],
        },
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: "user-going-1",
          email: "user-going-1@app.test",
          displayName: "Going User One",
          role: "user",
          passwordHash: "password123",
        },
        {
          id: "user-going-2",
          email: "user-going-2@app.test",
          displayName: "Going User Two",
          role: "user",
          passwordHash: "password123",
        },
      ],
    });

    const start = new Date("2030-04-20T15:00:00.000Z");
    const end = new Date("2030-04-20T17:00:00.000Z");

    await prisma.event.createMany({
      data: [
        {
          id: "prisma-rsvp-open-event",
          title: "Open RSVP Event",
          description: "Event with available capacity.",
          location: "Campus Center",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },
        {
          id: "prisma-rsvp-full-event",
          title: "Full RSVP Event",
          description: "Event used to test waitlist behavior.",
          location: "Small Room",
          category: "social",
          status: "published",
          capacity: 2,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },
        {
          id: "prisma-rsvp-toggle-event",
          title: "Toggle RSVP Event",
          description: "Event used to test cancellation.",
          location: "Library",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },
        {
          id: "prisma-rsvp-cancelled-event",
          title: "Cancelled RSVP Event",
          description: "Cancelled event used for RSVP error testing.",
          location: "Campus Center",
          category: "social",
          status: "cancelled",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },
        {
          id: "prisma-rsvp-past-event",
          title: "Past RSVP Event",
          description: "Past event used for RSVP error testing.",
          location: "Campus Center",
          category: "social",
          status: "past",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },
      ],
    });

    await prisma.rSVP.createMany({
      data: [
        {
          id: "prisma-going-1",
          eventId: "prisma-rsvp-full-event",
          userId: "user-going-1",
          status: "going",
          createdAt: new Date("2030-04-01T10:00:00.000Z"),
        },
        {
          id: "prisma-going-2",
          eventId: "prisma-rsvp-full-event",
          userId: "user-going-2",
          status: "going",
          createdAt: new Date("2030-04-01T10:05:00.000Z"),
        },
        {
          id: "prisma-existing-rsvp",
          eventId: "prisma-rsvp-toggle-event",
          userId: "user-reader",
          status: "going",
          createdAt: new Date("2030-04-01T10:10:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: {
          in: [
            "prisma-rsvp-open-event",
            "prisma-rsvp-full-event",
            "prisma-rsvp-toggle-event",
            "prisma-rsvp-cancelled-event",
            "prisma-rsvp-past-event",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-rsvp-open-event",
            "prisma-rsvp-full-event",
            "prisma-rsvp-toggle-event",
            "prisma-rsvp-cancelled-event",
            "prisma-rsvp-past-event",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: ["user-going-1", "user-going-2"],
        },
      },
    });

    await prisma.$disconnect();
  });

  // success path: creates "going" RSVP when event has available capacity
  it("creates a going RSVP in Prisma when the event has available capacity", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "prisma-rsvp-open-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("going");
    expect(result.value.rsvp.eventId).toBe("prisma-rsvp-open-event");
    expect(result.value.rsvp.userId).toBe("user-reader");

    const saved = await prisma.rSVP.findFirst({
      where: {
        eventId: "prisma-rsvp-open-event",
        userId: "user-reader",
      },
    });

    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("going");
  });

  // success path: creates "waitlisted" RSVP when event is full
  it("creates a waitlisted RSVP in Prisma when the event is full", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "prisma-rsvp-full-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("waitlisted");

    const saved = await prisma.rSVP.findFirst({
      where: {
        eventId: "prisma-rsvp-full-event",
        userId: "user-reader",
      },
    });

    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("waitlisted");
  });

  // success path: toggling existing RSVP updates it to "cancelled"
  it("cancels an existing RSVP in Prisma when the user toggles again", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "prisma-rsvp-toggle-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rsvp.status).toBe("cancelled");

    const saved = await prisma.rSVP.findUnique({
      where: {
        id: "prisma-existing-rsvp",
      },
    });

    expect(saved?.status).toBe("cancelled");
  });

  // error path: staff and admin cannot RSVP
  it("returns InvalidRSVPError when staff or admin attempts to RSVP with Prisma", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const staffResult = await service.toggleRSVP(
      "prisma-rsvp-open-event",
      "user-staff",
      "staff",
    );

    expect(staffResult.ok).toBe(false);
    if (staffResult.ok) return;

    expect(staffResult.value).toEqual(
      InvalidRSVPError("Organizers and admins cannot RSVP to events"),
    );

    const adminResult = await service.toggleRSVP(
      "prisma-rsvp-open-event",
      "user-admin",
      "admin",
    );

    expect(adminResult.ok).toBe(false);
    if (adminResult.ok) return;

    expect(adminResult.value).toEqual(
      InvalidRSVPError("Organizers and admins cannot RSVP to events"),
    );
  });

  // error path: returns EventNotFoundError for missing event
  it("returns EventNotFoundError when toggling RSVP for a missing Prisma event", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "missing-prisma-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      EventNotFoundError("Event missing-prisma-event not found"),
    );
  });

  // error path: cannot RSVP to cancelled event
  it("returns InvalidRSVPError when the Prisma event is cancelled", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "prisma-rsvp-cancelled-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidRSVPError("Cannot RSVP to a cancelled or past event"),
    );
  });

  // error path: cannot RSVP to past event
  it("returns InvalidRSVPError when the Prisma event is past", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const logger = makeLogger();

    const service = CreateRsvpService(rsvpRepo, eventRepo, logger);

    const result = await service.toggleRSVP(
      "prisma-rsvp-past-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      InvalidRSVPError("Cannot RSVP to a cancelled or past event"),
    );
  });
});
