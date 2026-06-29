import { Err, Ok, type Result } from "../lib/result";
import { UnexpectedDependencyError, type EventError } from "./errors";
import type { Event, EventStatus, EventFilters } from "./Event";
import type { IEventRepository } from "./EventRepository";

export const DEMO_EVENTS: Event[] = [
    {
        id: "event-published-1",
        title: "Spring Picnic",
        description: "Food, games, and fun on the lawn.",
        location: "Campus Pond Lawn",
        category: "party",
        status: "published",
        capacity: 25,
        startDatetime: new Date("2027-04-20T15:00:00"),
        endDatetime: new Date("2027-04-20T17:00:00"),
        organizerId: "user-staff",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "event-published-2",
        title: "Graduation Celebration",
        description: "Come congratulate our Seniors.",
        location: "Boston, MA",
        category: "graduation",
        status: "published",
        capacity: 100,
        startDatetime: new Date("2026-05-15T17:00:00"),
        endDatetime: new Date("2026-05-15T20:00:00"),
        organizerId: "user-admin",
        createdAt: new Date("2026-04-02T09:00:00"),
        updatedAt: new Date("2026-04-02T09:00:00"),
    },
    {
        id: "event-published-3",
        title: "Startup Networking Night",
        description: "Meet founders and investors.",
        location: "Innovation Hub",
        category: "business",
        status: "published",
        capacity: 40,
        startDatetime: new Date("2026-04-28T18:00:00"),
        endDatetime: new Date("2026-04-28T20:00:00"),
        organizerId: "user-staff",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "event-draft-1",
        title: "Draft Planning Meeting",
        description: "This is still a draft event.",
        location: "Student Union 201",
        category: "networking",
        status: "draft",
        capacity: 10,
        startDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        organizerId: "user-staff",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "event-cancelled-1",
        title: "Cancelled Hackathon",
        description: "This event has been cancelled.",
        location: "Engineering Hall",
        category: "technology",
        status: "cancelled",
        capacity: 50,
        startDatetime: new Date("2026-04-10T10:00:00"),
        endDatetime: new Date("2026-04-10T18:00:00"),
        organizerId: "user-staff",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "event-past-1",
        title: "Past Music Night",
        description: "An old music event that already happened.",
        location: "Campus Auditorium",
        category: "music",
        status: "past",
        capacity: 75,
        startDatetime: new Date("2026-03-01T19:00:00"),
        endDatetime: new Date("2026-03-01T22:00:00"),
        organizerId: "user-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        id: "event-draft-admin",
        title: "Admin Draft Event",
        description: "A draft owned by admin for cross-organizer testing.",
        location: "Admin Office",
        category: "networking",
        status: "draft",
        capacity: 10,
        startDatetime: new Date("2027-05-01T10:00:00"),
        endDatetime: new Date("2027-05-01T11:00:00"),
        organizerId: "user-admin",
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

export class InMemoryEventRepository implements IEventRepository {
    constructor(private readonly events: Event[]) { }

    async findById(eventId: string): Promise<Result<Event | null, EventError>> {
        try {
            const match = this.events.find((event) => event.id === eventId) ?? null;
            return Ok(match);
        } catch {
            return Err(UnexpectedDependencyError("Unable to read the event."));
        }
    }

    async findByOrganizer(organizerId: string): Promise<Result<Event[], EventError>> {
        try {
            const results: Event[] = this.events.filter((event) => event.organizerId === organizerId);
            return Ok(results);
        } catch {
            return Err(UnexpectedDependencyError("Unable to find organizer events."))
        }
    }

    async findAll(): Promise<Result<Event[], EventError>> {
        try {
            return Ok(this.events);
        } catch {
            return Err(UnexpectedDependencyError("Unable to read events."));
        }
    }

    async findPublishedUpcoming(filters?: EventFilters): Promise<Result<Event[], EventError>> {
        try {
            const now = new Date();
            let results: Event[] = this.events.filter((e) => e.status === "published" && e.startDatetime > now);

            if (filters?.category) {
                results = results.filter((e) => e.category === filters.category);
            }

            if (filters?.timeframe && filters.timeframe !== "all") {
                const timeframe = filters.timeframe;
                const cutoffDate = new Date(now);

                if (timeframe === "this_week") {
                    cutoffDate.setDate(now.getDate() + 7);
                } else if (timeframe === "this_month") {
                    cutoffDate.setMonth(now.getMonth() + 1);
                } else if (timeframe === "this_year") {
                    cutoffDate.setFullYear(now.getFullYear() + 1);
                }

                results = results.filter((e) => e.startDatetime <= cutoffDate);
            }

            return Ok(results);
        } catch {
            return Err(UnexpectedDependencyError("Unable to find the events."));
        }
    }

    async create(event: Event): Promise<Result<Event, EventError>> {
        try {
            this.events.push(event);
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Unable to create the event."));
        }
    }

    async update(event: Event): Promise<Result<Event | null, EventError>> {
        try {
            const index = this.events.findIndex((existing) => existing.id === event.id);
            if (index === -1) {
                return Ok(null);
            }
            const updatedEvent: Event = {
                ...event,
                updatedAt: new Date(),
            };
            this.events[index] = updatedEvent;
            return Ok(updatedEvent);
        } catch {
            return Err(UnexpectedDependencyError("Unable to update the event."));
        }
    }

    async updateStatus(eventId: string, status: EventStatus): Promise<Result<Event | null, EventError>> {
        try {
            const event = this.events.find((e) => e.id === eventId);
            if (!event) {
                return Ok(null);
            }
            event.status = status;
            event.updatedAt = new Date();
            return Ok(event);
        } catch {
            return Err(UnexpectedDependencyError("Unable to update the event status."));
        }
    }
}

export function CreateInMemoryEventRepository(): IEventRepository {
    return new InMemoryEventRepository(DEMO_EVENTS.map(e => ({ ...e })));
}
