import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Ok, Err } from "../../src/lib/result";
import { CreateEventService } from "../../src/events/EventService";
import { PrismaEventRepository } from "../../src/events/PrismaEventRepository";
import { PrismaRsvpRepository } from "../../src/rsvp/PrismaRsvpRepository";
import {
  EventNotFoundError,
  NotAuthorizedError,
  UnexpectedDependencyError as EventUnexpectedDependencyError,
} from "../../src/events/errors";
import { 
  UnexpectedDependencyError as RsvpUnexpectedDependencyError 
} from "../../src/rsvp/errors";
import {
  makeEvent,
  makeEventRepo,
  makeRsvpRepo,
} from "../helper/auth";

// Uses mocked repositories to test EventService logic without depending on the database.
describe("Feature 2: EventService.getEventDetailView", () => {
  // success path: all required fields exist and startDatetime < endDatetime
  it("returns event detail with all required fields populated", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo(Ok(5));
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
        "event-1",
        "user-reader",
        "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const event = result.value.event;

    // check that the field exists
    expect(event.title).toBeTruthy();
    expect(event.description).toBeTruthy();
    expect(event.location).toBeTruthy();
    expect(event.category).toBeTruthy();
    expect(event.startDatetime).toBeInstanceOf(Date);
    expect(event.endDatetime).toBeInstanceOf(Date);

    // checks that startDatetime < endDatetime
    expect(event.startDatetime.getTime()).toBeLessThan(event.endDatetime.getTime());
    });

  // success path: checks that attendee count feature propagates with detail page
  it("returns event detail view with attendee count for a published event", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo(Ok(7));
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "event-1",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.event.id).toBe("event-1");
    expect(result.value.attendeeCount).toBe(7);
    expect(eventRepo.findById).toHaveBeenCalledWith("event-1");
    expect(rsvpRepo.countGoing).toHaveBeenCalledWith("event-1");
  });

  // error path: missing event becomes EventNotFoundError
  it("returns EventNotFoundError when the event does not exist", async () => {
    const eventRepo = makeEventRepo(Ok(null));
    const rsvpRepo = makeRsvpRepo();
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "missing-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value.name).toBe("EventNotFoundError");
    expect(result.value).toEqual(
      EventNotFoundError("No event exists with the given ID."),
    );
  });

    // error path: NotAuthorizedError; checks authorization logic
  it("returns NotAuthorizedError when a user tries to view a draft event", async () => {
    const eventRepo = makeEventRepo(
      Ok(
        makeEvent({
          status: "draft",
          organizerId: "someone-else",
        }),
      ),
    );
    const rsvpRepo = makeRsvpRepo();
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "event-1",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      NotAuthorizedError("You are not authorized to view this event."),
    );
  });

  // error path: UnexpectedDependencyError; checks error propagation 
  it("maps RSVP repository failure into UnexpectedDependencyError", async () => {
    const eventRepo = makeEventRepo();
    const rsvpRepo = makeRsvpRepo(
        Err(RsvpUnexpectedDependencyError("Unable to count attendees.")),
    );
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "event-1",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
        EventUnexpectedDependencyError("Unable to count attendees."),
    );
  });
});

// Uses PrismaEventRepository and PrismaRsvpRepository against seeded database records
// Uses PrismaEventRepository and PrismaRsvpRepository against seeded database records
describe("Feature 2: EventService.getEventDetailView with Prisma", () => {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
  });

  const prisma = new PrismaClient({ adapter });

  beforeAll(async () => {
    await prisma.rSVP.deleteMany({
      where: {
        eventId: {
          in: [
            "prisma-published-event",
            "prisma-draft-event",
            "prisma-admin-draft-event",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-published-event",
            "prisma-draft-event",
            "prisma-admin-draft-event",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            "detail-user-1",
            "detail-user-2",
            "detail-user-3",
          ],
        },
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: "detail-user-1",
          email: "detail-user-1@app.test",
          displayName: "Detail User One",
          role: "user",
          passwordHash: "password123",
        },
        {
          id: "detail-user-2",
          email: "detail-user-2@app.test",
          displayName: "Detail User Two",
          role: "user",
          passwordHash: "password123",
        },
        {
          id: "detail-user-3",
          email: "detail-user-3@app.test",
          displayName: "Detail User Three",
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
          id: "prisma-published-event",
          title: "Prisma Published Picnic",
          description: "This event comes from the Prisma database.",
          location: "Campus Pond Lawn",
          category: "party",
          status: "published",
          capacity: 25,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },

        {
          id: "prisma-draft-event",
          title: "Prisma Draft Planning Meeting",
          description: "This draft comes from the Prisma database.",
          location: "Student Union 201",
          category: "networking",
          status: "draft",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-staff",
        },

        {
          id: "prisma-admin-draft-event",
          title: "Prisma Admin Draft",
          description: "This draft is owned by admin.",
          location: "Admin Office",
          category: "networking",
          status: "draft",
          capacity: 10,
          startDatetime: start,
          endDatetime: end,
          organizerId: "user-admin",
        },
      ],
    });

    await prisma.rSVP.createMany({
      data: [
        {
          id: "prisma-detail-rsvp-1",
          eventId: "prisma-published-event",
          userId: "detail-user-1",
          status: "going",
          createdAt: new Date("2030-04-01T10:00:00.000Z"),
        },
        {
          id: "prisma-detail-rsvp-2",
          eventId: "prisma-published-event",
          userId: "detail-user-2",
          status: "going",
          createdAt: new Date("2030-04-01T10:05:00.000Z"),
        },
        {
          id: "prisma-detail-rsvp-3",
          eventId: "prisma-published-event",
          userId: "detail-user-3",
          status: "waitlisted",
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
            "prisma-published-event",
            "prisma-draft-event",
            "prisma-admin-draft-event",
          ],
        },
      },
    });

    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            "prisma-published-event",
            "prisma-draft-event",
            "prisma-admin-draft-event",
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            "detail-user-1",
            "detail-user-2",
            "detail-user-3",
          ],
        },
      },
    });

    await prisma.$disconnect();
  });

  // Success path: published events can be loaded through Prisma and viewed by a regular user
  it("returns a published event from Prisma for a regular user", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "prisma-published-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.event.title).toBe("Prisma Published Picnic");
    expect(result.value.event.location).toBe("Campus Pond Lawn");
    expect(result.value.attendeeCount).toBe(2);
  });

  // Success path: staff can view their own drafts and published events
  it("allows staff to view their own draft event and all published events from Prisma", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const draftResult = await service.getEventDetailView(
      "prisma-draft-event",
      "user-staff",
      "staff",
    );

    expect(draftResult.ok).toBe(true);
    if (!draftResult.ok) return;

    expect(draftResult.value.event.title).toBe(
      "Prisma Draft Planning Meeting",
    );
    expect(draftResult.value.event.status).toBe("draft");

    const publishedResult = await service.getEventDetailView(
      "prisma-published-event",
      "user-staff",
      "staff",
    );

    expect(publishedResult.ok).toBe(true);
    if (!publishedResult.ok) return;

    expect(publishedResult.value.event.title).toBe(
      "Prisma Published Picnic",
    );
    expect(publishedResult.value.event.status).toBe("published");
    expect(publishedResult.value.event.organizerId).toBe("user-staff");
  });

  // Success path: allows admin to view drafts regardless of organizer
  it("allows admin to view a draft event from Prisma", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "prisma-draft-event",
      "user-admin",
      "admin",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.event.status).toBe("draft");
  });

  // error path: blocks users from viewing drafts
  it("blocks regular users from viewing a draft event from Prisma", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "prisma-draft-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      NotAuthorizedError("You are not authorized to view this event."),
    );
  });

  // error path: blocks staff from viewing drafts that are not their own
  it("blocks staff from viewing draft events they did not create from Prisma", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "prisma-admin-draft-event",
      "user-staff",
      "staff",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      NotAuthorizedError("You are not authorized to view this event."),
    );
  });

  // error path: missing event becomes EventNotFoundError
  it("returns EventNotFoundError for a missing Prisma event", async () => {
    const eventRepo = new PrismaEventRepository(prisma);
    const rsvpRepo = new PrismaRsvpRepository(prisma);
    const service = CreateEventService(eventRepo, rsvpRepo);

    const result = await service.getEventDetailView(
      "missing-prisma-event",
      "user-reader",
      "user",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.value).toEqual(
      EventNotFoundError("No event exists with the given ID."),
    );
  });
});