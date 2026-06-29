import { Ok, Err, type Result } from "../lib/result";
import type { RSVP, RSVPAttendee, RSVPConflict, RSVPWithEvent } from "./RSVP";
import type { IRSVPRepository } from "./RsvpRepository";
import type { Event } from "../events/Event";
import { UnexpectedDependencyError, type RSVPError } from "./errors";
import { DEMO_EVENTS } from "../events/InMemoryEventRepository";
import { DEMO_USERS } from "../auth/InMemoryUserRepository";
import type { IUserRecord } from "../auth/User";

export const DEMO_RSVPS: RSVP[] = [
    {
        id: "rsvp-1",
        eventId: "event-published-1",
        userId: "user-reader",
        status: "going",
        createdAt: new Date("2026-04-05T10:00:00"),
    },
    {
        id: "rsvp-2",
        eventId: "event-published-1",
        userId: "user-admin",
        status: "waitlisted",
        createdAt: new Date("2026-04-05T10:05:00"),
    },
    {
        id: "rsvp-3",
        eventId: "event-published-1",
        userId: "user-staff",
        status: "going",
        createdAt: new Date("2026-04-05T10:10:00"),
    },
    {
        id: "rsvp-4",
        eventId: "event-published-2",
        userId: "user-reader",
        status: "cancelled",
        createdAt: new Date("2026-04-06T09:00:00"),
    },
];

class InMemoryRSVPRepository implements IRSVPRepository {
    constructor(
        private readonly events: Event[],
        private readonly rsvps: RSVP[],
        private readonly users: IUserRecord[],
    ) { }

    async findByUser(userId: string): Promise<Result<RSVPWithEvent[], RSVPError>> {
        try {
            const result = this.rsvps
                .filter((r) => r.userId === userId)
                .flatMap((r) => {
                    const event = this.events.find((e) => e.id === r.eventId)
                    if (!event) return [];
                    return [{ ...r, event }];
                })
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            return Ok(result);
        } catch {
            return Err(UnexpectedDependencyError("Unable to read RSVPs."));
        }
    }

    async findByEventId(eventId: string): Promise<Result<RSVP[], RSVPError>> {
        try {
            const result = this.rsvps
                .filter((r) => r.eventId === eventId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            return Ok(result)
        } catch {
            return Err(UnexpectedDependencyError("Unable to read RSVPs for event."))
        }
    }

    async findAttendeesByEventId(eventId: string): Promise<Result<RSVPAttendee[], RSVPError>> {
        try {
            const result = this.rsvps
                .filter((r) => r.eventId === eventId)
                .map((r): RSVPAttendee => {
                    const user = this.users.find((u) => u.id === r.userId);
                    return {
                        ...r,
                        displayName: user?.displayName ?? r.userId,
                    };
                })
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

            return Ok(result);
        } catch {
            return Err(UnexpectedDependencyError("Unable to read attendee list for event."));
        }
    }

    async findByUserAndEvent(userId: string, eventId: string): Promise<Result<RSVP | null, RSVPError>> {
        try {
            const match = this.rsvps.find((r) => r.userId === userId && r.eventId === eventId)
            return Ok(match ?? null)
        } catch {
            return Err(UnexpectedDependencyError("Unable to look up RSVP."))
        }
    }

    async findOverlappingActiveRsvps(
        userId: string,
        eventId: string,
        startDatetime: Date,
        endDatetime: Date,
    ): Promise<Result<RSVPConflict[], RSVPError>> {
        try {
            const overlaps = this.rsvps
                .filter((rsvp) =>
                    rsvp.userId === userId &&
                    rsvp.eventId !== eventId &&
                    (rsvp.status === "going" || rsvp.status === "waitlisted")
                )
                .flatMap((rsvp) => {
                    const event = this.events.find((e) => e.id === rsvp.eventId);

                    if (!event) return [];
                    const overlapsTime =
                        event.startDatetime < endDatetime &&
                        event.endDatetime > startDatetime;

                    if (!overlapsTime) return [];
                    return [{
                        ...rsvp,
                        event,
                    }];
                });
            return Ok(overlaps);
        } catch {
            return Err(
                UnexpectedDependencyError(
                    "Unable to find overlapping RSVPs.",
                ),
            );
        }
    }

    async countGoing(eventId: string): Promise<Result<number, RSVPError>> {
        try {
            const count = this.rsvps.filter((r) => r.eventId === eventId && r.status === "going").length;
            return Ok(count);
        } catch {
            return Err(UnexpectedDependencyError("Unable to count attendees."))
        }
    }

    async save(rsvp: RSVP): Promise<Result<RSVP, RSVPError>> {
        try {
            const index = this.rsvps.findIndex((r) => r.id === rsvp.id);
            if (index !== -1) {
                this.rsvps[index] = rsvp;
            } else {
                this.rsvps.push(rsvp)
            }
            return Ok(rsvp)
        } catch {
            return Err(UnexpectedDependencyError("Unable to save RSVP."))
        }
    }
}

export function CreateInMemoryRsvpRepository(): IRSVPRepository {
    return new InMemoryRSVPRepository([...DEMO_EVENTS], [...DEMO_RSVPS], [...DEMO_USERS])
}
