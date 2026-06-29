import type { PrismaClient, Prisma, Event as PrismaEvent } from "@prisma/client";
import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { Event, EventStatus, EventFilters } from "./Event";
import type { IEventRepository } from "./EventRepository";
import { UnexpectedDependencyError, type EventError } from "./errors";

export class PrismaEventRepository implements IEventRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findById(eventId: string): Promise<Result<Event | null, EventError>> {
        try {
            const event = await this.prisma.event.findUnique({
                where: { id: eventId },
            });
            return Ok(event ? this.toEvent(event) : null);
        } catch {
            return Err(UnexpectedDependencyError("Unable to find event."));
        }
    }

    async findByOrganizer(organizerId: string): Promise<Result<Event[], EventError>> {
        try {
            const events = await this.prisma.event.findMany({
                where: { organizerId },
            });

            return Ok(events.map((event) => this.toEvent(event)));
        } catch {
            return Err(UnexpectedDependencyError("Unable to find organizer events."));
        }
    }

    async findAll(): Promise<Result<Event[], EventError>> {
        try {
            const events = await this.prisma.event.findMany();
            return Ok(events.map((event) => this.toEvent(event)));
        } catch {
            return Err(UnexpectedDependencyError("Unable to find the events."));
        }
    }

    async findPublishedUpcoming(filters?: EventFilters): Promise<Result<Event[], EventError>> {
        try {
            const now = new Date();
            const where: Prisma.EventWhereInput = {
                status: "published",
                startDatetime: {
                    gt: now,
                },
            };

            if (filters?.category) {
                where.category = filters.category;
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
                where.startDatetime = {
                    gt: now,
                    lte: cutoffDate,
                };
            }
            const events = await this.prisma.event.findMany({ where });
            return Ok(events.map((event) => this.toEvent(event)));
        } catch {
            return Err(UnexpectedDependencyError("Unable to find the events."));
        }
    }

    async create(event: Event): Promise<Result<Event, EventError>> {
        try {
            const created = await this.prisma.event.create({
                data: {
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    category: event.category,
                    status: event.status,
                    capacity: event.capacity,
                    startDatetime: event.startDatetime,
                    endDatetime: event.endDatetime,
                    organizerId: event.organizerId,
                    createdAt: event.createdAt,
                    updatedAt: event.updatedAt,
                },
            });
            return Ok(this.toEvent(created));
        } catch {
            return Err(UnexpectedDependencyError("Unable to create the event."));
        }
    }

    async update(event: Event): Promise<Result<Event | null, EventError>> {
        try {
            const existing = await this.prisma.event.findUnique({
                where: { id: event.id },
            });

            if (!existing) {
                return Ok(null);
            }

            const updated = await this.prisma.event.update({
                where: { id: event.id },
                data: {
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    category: event.category,
                    status: event.status,
                    capacity: event.capacity,
                    startDatetime: event.startDatetime,
                    endDatetime: event.endDatetime,
                    updatedAt: new Date(),
                },
            });
            return Ok(this.toEvent(updated));
        } catch {
            return Err(UnexpectedDependencyError("Unable to update the event."));
        }
    }

    async updateStatus(eventId: string, status: EventStatus): Promise<Result<Event | null, EventError>> {
        try {
            const event = await this.prisma.event.update({
                where: { id: eventId },
                data: { status, updatedAt: new Date() },
            });
            return Ok(this.toEvent(event));
        } catch {
            return Err(UnexpectedDependencyError("Unable to update the event status."));
        }
    }

    private toEvent(prismaEvent: PrismaEvent): Event {
        return {
            id: prismaEvent.id,
            title: prismaEvent.title,
            description: prismaEvent.description,
            location: prismaEvent.location,
            category: prismaEvent.category,
            status: prismaEvent.status as EventStatus,
            capacity: prismaEvent.capacity,
            startDatetime: prismaEvent.startDatetime,
            endDatetime: prismaEvent.endDatetime,
            organizerId: prismaEvent.organizerId,
            createdAt: prismaEvent.createdAt,
            updatedAt: prismaEvent.updatedAt,
        };
    }
}