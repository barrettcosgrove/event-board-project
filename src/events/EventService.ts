import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import {
    isEventCategory,
    isEventTimeframe,
    type Event,
    type EventCategory,
    type EventDetailView,
    type EventStatus,
    type EventTimeframe,
} from "./Event";
import type {
  EventNotFoundError as EventNotFoundErrorType,
  InvalidEventStateError as InvalidEventStateErrorType,
  InvalidInputError as InvalidInputErrorType,
  InvalidSearchQueryError as InvalidSearchQueryErrorType,
  NotAuthorizedError as NotAuthorizedErrorType,
  UnexpectedDependencyError as UnexpectedDependencyErrorType,
} from "./errors";
import {
    EventNotFoundError,
    InvalidEventStateError,
    InvalidInputError,
    InvalidSearchQueryError,
    NotAuthorizedError,
    UnexpectedDependencyError,
} from "./errors";
import type { IEventRepository } from "./EventRepository";
import type { IRSVPRepository } from "../rsvp/RsvpRepository";
import { randomUUID } from "node:crypto";

export interface IListEventsFilters {
    category?: EventCategory;
    timeframe?: EventTimeframe;
    searchQuery?: string;
}

type GetEventByIdError =
  | EventNotFoundErrorType
  | NotAuthorizedErrorType
  | UnexpectedDependencyErrorType;

type EventDetailError =
  GetEventByIdError;

type CreateEventError =
  | NotAuthorizedErrorType
  | InvalidInputErrorType
  | UnexpectedDependencyErrorType;

type UpdateEventStatusError =
  | EventNotFoundErrorType
  | NotAuthorizedErrorType
  | InvalidEventStateErrorType
  | UnexpectedDependencyErrorType;

type GetAllEventsForOrganizerError =
  | NotAuthorizedErrorType
  | UnexpectedDependencyErrorType;

type UpdateEventError =
  | EventNotFoundErrorType
  | NotAuthorizedErrorType
  | InvalidEventStateErrorType
  | InvalidInputErrorType
  | UnexpectedDependencyErrorType;

type ListEventsError =
  | InvalidInputErrorType
  | InvalidSearchQueryErrorType
  | UnexpectedDependencyErrorType;

export interface IEventService {
    getEventById(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<Event, GetEventByIdError>>;
    getEventDetailView(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<EventDetailView, EventDetailError>>;
    createEvent(
        actingUserId: string,
        actingUserRole: UserRole,
        data: {
            title: string;
            description: string;
            location: string;
            category: string;
            capacity: number | null;
            startDatetime: Date;
            endDatetime: Date;
        },
    ): Promise<Result<Event, CreateEventError>>;
    updateEventStatus(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
        newStatus: EventStatus,
    ): Promise<Result<Event, UpdateEventStatusError>>;
    getAllEventsForOrganizer(
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<Event[], GetAllEventsForOrganizerError>>;
    updateEvent(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
        data: Partial<{
            title: string;
            description: string;
            location: string;
            category: string;
            capacity: number | null;
            startDatetime: Date;
            endDatetime: Date;
        }>
    ): Promise<Result<Event, UpdateEventError>>;
    listEvents(
        actingUserId: string,
        actingUserRole: UserRole,
        filters?: IListEventsFilters,
    ): Promise<Result<Event[], ListEventsError>>;
}

class EventService implements IEventService {
    private static readonly MAX_SEARCH_QUERY_LENGTH = 100;

    private static includesSearchMatch(event: Event, searchQuery: string): boolean {
        const title = event.title.toLowerCase();
        const description = event.description.toLowerCase();
        const location = event.location.toLowerCase();

        return (
            title.includes(searchQuery) ||
            description.includes(searchQuery) ||
            location.includes(searchQuery)
        );
    }

    private async addConflictWarnings(
        actingUserId: string,
        events: Event[],
        allEvents: Event[],
    ): Promise<Result<Event[], ListEventsError>> {
        const userRsvpsResult = await this.rsvpRepository.findByUser(actingUserId);
        if (userRsvpsResult.ok === false) {
            return Err(UnexpectedDependencyError(userRsvpsResult.value.message));
        }

        const eventById = new Map(allEvents.map((event) => [event.id, event]));
        const activeRsvps = userRsvpsResult.value.filter(
            (rsvp) => rsvp.status === "going" || rsvp.status === "waitlisted",
        );

        const conflictWarningByEventId = new Map<string, string>();

        for (const rsvp of activeRsvps) {
            const event = eventById.get(rsvp.eventId);
            if (!event) continue;

            const overlapsResult = await this.rsvpRepository.findOverlappingActiveRsvps(
                actingUserId,
                event.id,
                event.startDatetime,
                event.endDatetime,
            );
            if (overlapsResult.ok === false) {
                return Err(UnexpectedDependencyError(overlapsResult.value.message));
            }

            if (overlapsResult.value.length > 0) {
                const firstConflict = overlapsResult.value[0];
                conflictWarningByEventId.set(
                    event.id,
                    `Conflicts with ${firstConflict.event.title}`,
                );
            }
        }

        return Ok(events.map((event) => ({
            ...event,
            conflictWarning: conflictWarningByEventId.get(event.id) ?? null,
        })));
    }

    constructor(
        private readonly eventRepository: IEventRepository,
        private readonly rsvpRepository: IRSVPRepository,
    ) { }

    async getEventById(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<Event, GetEventByIdError>> {
        const eventResult = await this.eventRepository.findById(eventId);

        if (eventResult.ok === false) {
            return Err(UnexpectedDependencyError(eventResult.value.message));
        }

        const event = eventResult.value;

        if (event === null) {
            return Err(EventNotFoundError("No event exists with the given ID."));
        }

        if (actingUserRole === "admin") {
            return Ok(event);
        }

        if (actingUserRole === "staff") {
            const canView =
                event.status === "published" ||
                (event.status === "draft" && event.organizerId === actingUserId);
            if (canView) {
                return Ok(event);
            }
            return Err(NotAuthorizedError("You are not authorized to view this event."));
        }

        if (actingUserRole === "user") {
            const canView = event.status === "published";
            if (canView) {
                return Ok(event);
            }
            return Err(NotAuthorizedError("You are not authorized to view this event."));
        }
        return Err(NotAuthorizedError("You are not authorized to view this event."));
    }

    async getEventDetailView(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<EventDetailView, EventDetailError>> {
        const eventResult = await this.getEventById(eventId, actingUserId, actingUserRole);

        if (eventResult.ok === false) {
            return Err(eventResult.value);
        }
        const event = eventResult.value;
        const attendeeCountResult = await this.rsvpRepository.countGoing(eventId);

        if (attendeeCountResult.ok === false) {
            return Err(UnexpectedDependencyError(attendeeCountResult.value.message));
        }

        return Ok({
            event: event,
            attendeeCount: attendeeCountResult.value,
        });
    }

    async createEvent(
        actingUserId: string,
        actingUserRole: UserRole,
        data: {
            title: string;
            description: string;
            location: string;
            category: string;
            capacity: number | null;
            startDatetime: Date;
            endDatetime: Date;
        },
    ): Promise<Result<Event, CreateEventError>> {
        if (actingUserRole === "user") {
            return Err(NotAuthorizedError("Only organizers and admins can create events."));
        }

        if (!data.title.trim()) {
            return Err(InvalidInputError("Title is required."));
        }
        if (!data.description.trim()) {
            return Err(InvalidInputError("Description is required."));
        }
        if (!data.location.trim()) {
            return Err(InvalidInputError("Location is required."));
        }
        if (!data.category.trim()) {
            return Err(InvalidInputError("Category is required."));
        }
        if (isNaN(data.startDatetime.getTime())) {
            return Err(InvalidInputError("Start date and time is invalid."));
        }
        if (isNaN(data.endDatetime.getTime())) {
            return Err(InvalidInputError("End date and time is invalid."));
        }
        if (data.endDatetime <= data.startDatetime) {
            return Err(InvalidInputError("End date and time must be after start date and time."));
        }
        if (data.capacity !== null && (data.capacity < 1 || !Number.isInteger(data.capacity))) {
            return Err(InvalidInputError("Capacity must be a positive whole number."));
        }

        const now = new Date();
        const event: Event = {
            id: randomUUID(),
            ...data,
            organizerId: actingUserId,
            status: "draft",
            createdAt: now,
            updatedAt: now,
        };

        const createResult = await this.eventRepository.create(event);
        
        if (createResult.ok === false) {
            return Err(UnexpectedDependencyError(createResult.value.message));
        }

        return Ok(createResult.value);
    }

    async updateEventStatus(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
        newStatus: EventStatus,
    ): Promise<Result<Event, UpdateEventStatusError>> {
        const result = await this.eventRepository.findById(eventId);

        if (result.ok === false) {
            return Err(UnexpectedDependencyError(result.value.message));
        }

        const event = result.value;

        if (!event) {
            return Err(EventNotFoundError("No event exists with the given ID."));
        }

        const isOwner = actingUserRole === "staff" && event.organizerId === actingUserId;
        const isAdmin = actingUserRole === "admin";

        if (!isOwner && !isAdmin) {
            return Err(NotAuthorizedError("You are not authorized to update the event status."));
        }

        if (newStatus !== "published" && newStatus !== "cancelled") {
            return Err(
                InvalidEventStateError(
                    `Invalid target status "${newStatus}". Only "published" or "cancelled" are allowed.`,
                ),
            );
        }

        const isDraftToPublished = event.status === "draft" && newStatus === "published";
        const isPublishedToCancelled = event.status === "published" && newStatus === "cancelled";

        if (!isDraftToPublished && !isPublishedToCancelled) {
            return Err(
                InvalidEventStateError(
                    `Invalid status transition from "${event.status}" to "${newStatus}".`,
                ),
            );
        }

        const updateResult = await this.eventRepository.updateStatus(eventId, newStatus);

        if (updateResult.ok === false) {
            return Err(UnexpectedDependencyError(updateResult.value.message));
        }

        const updated = updateResult.value;
        if (!updated) {
            return Err(EventNotFoundError("No event exists with the given ID."));
        }

        return Ok(updated);
    }

    async getAllEventsForOrganizer(
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<Event[], GetAllEventsForOrganizerError>> {
        if (actingUserRole === "user") {
            return Err(NotAuthorizedError("You are not authorized to view these events."));
        }
    
        if (actingUserRole === "admin") {
            const result = await this.eventRepository.findAll();

            if (result.ok === false) {
                return Err(UnexpectedDependencyError(result.value.message));
            }

            const sorted = [...result.value].sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            );
            return Ok(sorted);
        }

        const result = await this.eventRepository.findByOrganizer(actingUserId);
        if (result.ok === false) {
            return Err(UnexpectedDependencyError(result.value.message));
        }

        const sorted = [...result.value].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        return Ok(sorted);
        
    }

    async updateEvent(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
        data: Partial<{
            title: string;
            description: string;
            location: string;
            category: string;
            capacity: number | null;
            startDatetime: Date;
            endDatetime: Date;
        }>,
    ): Promise<Result<Event, UpdateEventError>> {
        const findResult = await this.eventRepository.findById(eventId);
        if (findResult.ok === false) {
            return Err(UnexpectedDependencyError(findResult.value.message));
        }

        const existing = findResult.value;
        if (!existing) {
            return Err(EventNotFoundError("Event not found."));
        }

        if (actingUserRole !== "admin" && existing.organizerId !== actingUserId) {
            return Err(NotAuthorizedError("You do not have permission to edit this event."));
        }

        if (existing.status === "cancelled" || existing.status === "past") {
            return Err(InvalidEventStateError("Cancelled or past events cannot be edited."));
        }

        if (data.title !== undefined && !data.title.trim()) {
            return Err(InvalidInputError("Title is required."));
        }
        if (data.description !== undefined && !data.description.trim()) {
            return Err(InvalidInputError("Description is required."));
        }
        if (data.location !== undefined && !data.location.trim()) {
            return Err(InvalidInputError("Location is required."));
        }
        if (data.category !== undefined && !data.category.trim()) {
            return Err(InvalidInputError("Category is required."));
        }
        if (data.startDatetime !== undefined && isNaN(data.startDatetime.getTime())) {
            return Err(InvalidInputError("Start date and time is invalid."));
        }
        if (data.endDatetime !== undefined && isNaN(data.endDatetime.getTime())) {
            return Err(InvalidInputError("End date and time is invalid."));
        }
        if (data.startDatetime && data.endDatetime && data.endDatetime <= data.startDatetime) {
            return Err(InvalidInputError("End date and time must be after start date and time."));
        }
        if (
            data.capacity !== undefined &&
            data.capacity !== null &&
            (data.capacity < 1 || !Number.isInteger(data.capacity))
        ) {
            return Err(InvalidInputError("Capacity must be a positive whole number."));
        }

        const merged = { ...existing, ...data };
        const updateResult = await this.eventRepository.update({ ...merged, updatedAt: new Date() });

        if (updateResult.ok === false) {
            return Err(UnexpectedDependencyError(updateResult.value.message));
        }

        if (!updateResult.value) {
            return Err(EventNotFoundError("Event could not be updated."));
        }

        return Ok(updateResult.value);
    }

    async listEvents(
        actingUserId: string,
        actingUserRole: UserRole,
        filters: IListEventsFilters = {},
    ): Promise<Result<Event[], ListEventsError>> {
        const normalizedCategory = filters.category?.trim() || undefined;
        const normalizedTimeframe = filters.timeframe?.trim() || undefined;
        let categoryFilter: EventCategory | undefined;
        let timeframeFilter: EventTimeframe | undefined;

        if (normalizedCategory !== undefined) {
            if (!isEventCategory(normalizedCategory)) {
                return Err(InvalidInputError("Invalid category filter."));
            }
            categoryFilter = normalizedCategory;
        }

        if (normalizedTimeframe !== undefined) {
            if (!isEventTimeframe(normalizedTimeframe)) {
                return Err(InvalidInputError("Invalid timeframe filter."));
            }
            timeframeFilter = normalizedTimeframe;
        }

        const allEventsResult = await this.eventRepository.findAll();

        if (allEventsResult.ok === false) {
            return Err(UnexpectedDependencyError(allEventsResult.value.message));
        }

        const now = new Date();
        let visibleEvents = allEventsResult.value;

        if (actingUserRole === "user") {
            visibleEvents = visibleEvents.filter(
                (event) =>
                    event.status === "published" &&
                    event.startDatetime > now,
            );
        } else if (actingUserRole === "staff") {
            visibleEvents = visibleEvents.filter(
                (event) =>
                    (event.status === "published" && event.startDatetime > now) ||
                    (event.status === "draft" && event.organizerId === actingUserId),
            );
        }
        // admin sees all events, including drafts

        if (categoryFilter !== undefined) {
            visibleEvents = visibleEvents.filter((event) => event.category === categoryFilter);
        }

        if (timeframeFilter !== undefined && timeframeFilter !== "all") {
            const cutoffDate = new Date(now);

            if (timeframeFilter === "this_week") {
                cutoffDate.setDate(now.getDate() + 7);
            } else if (timeframeFilter === "this_month") {
                cutoffDate.setMonth(now.getMonth() + 1);
            } else if (timeframeFilter === "this_year") {
                cutoffDate.setFullYear(now.getFullYear() + 1);
            }

            visibleEvents = visibleEvents.filter((event) => event.startDatetime <= cutoffDate);
        }

        const searchQuery = (filters.searchQuery ?? "").trim().toLowerCase();
        if (searchQuery.length > EventService.MAX_SEARCH_QUERY_LENGTH) {
            return Err(
                InvalidSearchQueryError(
                    `Search query must be ${EventService.MAX_SEARCH_QUERY_LENGTH} characters or fewer.`,
                ),
            );
        }

        const searchedEvents = searchQuery.length === 0
            ? visibleEvents
            : visibleEvents.filter((event) =>
            EventService.includesSearchMatch(event, searchQuery),
        );

        return this.addConflictWarnings(actingUserId, searchedEvents, allEventsResult.value);
    }
}

export function CreateEventService(
    eventRepository: IEventRepository,
    rsvpRepository: IRSVPRepository,
): IEventService {
    return new EventService(eventRepository, rsvpRepository);
}
