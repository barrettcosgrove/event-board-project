import type { PrismaClient, RSVP as PrismaRsvp, Event as PrismaEvent } from "@prisma/client";
import { Ok, Err, type Result } from "../lib/result";
import type { IRSVPRepository } from "./RsvpRepository";
import type { RSVP, RSVPAttendee, RSVPConflict, RSVPWithEvent } from "./RSVP";
import type { RSVPError } from "./errors";
import { UnexpectedDependencyError } from "./errors";

type PrismaRsvpWithEvent = PrismaRsvp & { event: PrismaEvent };

function toRSVP(record: PrismaRsvp): RSVP {
  return {
    id: record.id,
    eventId: record.eventId,
    userId: record.userId,
    status: record.status as RSVP["status"],
    createdAt: record.createdAt,
  };
}

function toRSVPWithEvent(record: PrismaRsvpWithEvent): RSVPWithEvent {
  return {
    ...toRSVP(record),
    event: {
      id: record.event.id,
      title: record.event.title,
      description: record.event.description,
      location: record.event.location,
      category: record.event.category,
      status: record.event.status as RSVPWithEvent["event"]["status"],
      capacity: record.event.capacity,
      startDatetime: record.event.startDatetime,
      endDatetime: record.event.endDatetime,
      organizerId: record.event.organizerId,
      createdAt: record.event.createdAt,
      updatedAt: record.event.updatedAt,
    },
  };
}

export class PrismaRsvpRepository implements IRSVPRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(userId: string): Promise<Result<RSVPWithEvent[], RSVPError>> {
    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: { userId },
        include: { event: true },
      });

      return Ok(rsvps.map(toRSVPWithEvent));
    } catch {
      return Err(UnexpectedDependencyError("Unable to find RSVPs by user."));
    }
  }

  async findByEventId(eventId: string): Promise<Result<RSVP[], RSVPError>> {
    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
      });

      return Ok(rsvps.map(toRSVP));
    } catch {
      return Err(UnexpectedDependencyError("Unable to read RSVPs for event."));
    }
  }

  async findAttendeesByEventId(eventId: string): Promise<Result<RSVPAttendee[], RSVPError>> {
    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: { eventId },
        orderBy: { createdAt: "asc" },
        include: {
          user: true,
        }
      });

      const attendees: RSVPAttendee[] = rsvps.map((rsvp) => ({
        ...toRSVP(rsvp),
        displayName: rsvp.user.displayName,
      }));

      return Ok(attendees);
    } catch {
      return Err(UnexpectedDependencyError("Unable to read attendee list for event."));
    }
  }

  async findByUserAndEvent(
    userId: string,
    eventId: string,
  ): Promise<Result<RSVP | null, RSVPError>> {
    try {
      const rsvp = await this.prisma.rSVP.findFirst({
        where: { userId, eventId },
      });

      return Ok(rsvp ? toRSVP(rsvp) : null);
    } catch {
      return Err(UnexpectedDependencyError("Unable to find RSVP."));
    }
  }

  async findOverlappingActiveRsvps(
    userId: string,
    eventId: string,
    startDatetime: Date,
    endDatetime: Date,
  ): Promise<Result<RSVPConflict[], RSVPError>> {
    try {
      const rsvps = await this.prisma.rSVP.findMany({
        where: {
          userId,
          eventId: {
            not: eventId,
          },
          status: {
            in: ["going", "waitlisted"],
          },
          event: {
            status: "published",
            startDatetime: {
              lt: endDatetime,
            },
            endDatetime: {
              gt: startDatetime,
            },
          },
        },
        include: {
          event: true,
        },
        orderBy: {
          event: {
            startDatetime: "asc",
          },
        },
      });

      return Ok(rsvps.map(toRSVPWithEvent));
    } catch {
      return Err(UnexpectedDependencyError("Unable to find overlapping RSVPs."));
    }
  }

  async countGoing(eventId: string): Promise<Result<number, RSVPError>> {
    try {
      const count = await this.prisma.rSVP.count({
        where: {
          eventId,
          status: "going",
        },
      });

      return Ok(count);
    } catch {
      return Err(UnexpectedDependencyError("Unable to count attendees."));
    }
  }

  async save(rsvp: RSVP): Promise<Result<RSVP, RSVPError>> {
    try {
      const existing = await this.prisma.rSVP.findFirst({
        where: {
          userId: rsvp.userId,
          eventId: rsvp.eventId,
        },
      });

      const saved = existing
        ? await this.prisma.rSVP.update({
            where: { id: existing.id },
            data: {
              status: rsvp.status,
            },
          })
        : await this.prisma.rSVP.create({
            data: {
              id: rsvp.id,
              eventId: rsvp.eventId,
              userId: rsvp.userId,
              status: rsvp.status,
              createdAt: rsvp.createdAt,
            },
          });

      return Ok(toRSVP(saved));
    } catch {
      return Err(UnexpectedDependencyError("Unable to save RSVP."));
    }
  }
}
