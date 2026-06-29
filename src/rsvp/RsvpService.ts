import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { ILoggingService } from "../service/LoggingService";
import { 
    EventNotFoundError, 
    InvalidRSVPError, 
    NotAuthorizedError, 
    UnexpectedDependencyError 
} from "./errors";
import type {
  EventNotFoundError as EventNotFoundErrorType,
  InvalidRSVPError as InvalidRSVPErrorType,
  NotAuthorizedError as NotAuthorizedErrorType,
  UnexpectedDependencyError as UnexpectedDependencyErrorType,
} from "./errors";
import type { IRSVPRepository } from "./RsvpRepository";
import type { RSVP, RSVPAttendee, RSVPConflict, RSVPWithEvent } from "./RSVP";
import type { IEventRepository } from "../events/EventRepository";

export interface IAttendeeGroups {
    going: RSVPAttendee[];
    waitlisted: RSVPAttendee[];
    cancelled: RSVPAttendee[];
}

export interface IToggleRSVPResult {
    rsvp: RSVP;
    conflicts: RSVPConflict[];
}

export type RSVPWithEventAndConflict = RSVPWithEvent & {
    conflictWarning: string | null;
};

export interface IUserDashboardRSVPs {
    upcoming: RSVPWithEventAndConflict[];
    pastCancelled: RSVPWithEvent[];
}


type GetRsvpsByUserError = UnexpectedDependencyErrorType;

type GetDashboardRsvpsError = UnexpectedDependencyErrorType;

type GetRsvpsByEventError =
  | InvalidRSVPErrorType
  | EventNotFoundErrorType
  | NotAuthorizedErrorType
  | UnexpectedDependencyErrorType;

type ToggleRsvpError =
  | InvalidRSVPErrorType
  | EventNotFoundErrorType
  | UnexpectedDependencyErrorType;

type GetAttendeeCountError =
  | EventNotFoundErrorType
  | UnexpectedDependencyErrorType;

export interface IRsvpService {
    getRSVPsByUser(userId: string): Promise<Result<RSVPWithEvent[], GetRsvpsByUserError>>;
    getDashboardRSVPs(userId: string): Promise<Result<IUserDashboardRSVPs, GetDashboardRsvpsError>>;
    getRSVPsByEvent(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IAttendeeGroups, GetRsvpsByEventError>>;
    toggleRSVP(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IToggleRSVPResult, ToggleRsvpError>>;
    getAttendeeCount(eventId: string): Promise<Result<number, GetAttendeeCountError>>;
}

class RsvpService implements IRsvpService {
    constructor(
        private readonly rsvpRepo: IRSVPRepository,
        private readonly eventRepo: IEventRepository,
        private readonly logger: ILoggingService,
    ) { }

    async getRSVPsByUser(userId: string): Promise<Result<RSVPWithEvent[], GetRsvpsByUserError>> {
        this.logger.info(`Fetching RSVPs for user ${userId}`);
        const result = await this.rsvpRepo.findByUser(userId);

        if (result.ok === false ) {
            return Err(UnexpectedDependencyError(result.value.message));
        }

        const sorted = [...result.value].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        return Ok(sorted);
    }

    async getDashboardRSVPs(userId: string): Promise<Result<IUserDashboardRSVPs, GetDashboardRsvpsError>> {
        this.logger.info(`Fetching RSVPs for user ${userId}`);
        const result = await this.rsvpRepo.findByUser(userId);

        if (result.ok === false) {
            return Err(UnexpectedDependencyError(result.value.message));
        }
        
        const now = new Date();
        const upcoming: RSVPWithEventAndConflict[] = [];
        const pastCancelled: RSVPWithEvent[] = [];

        for (const rsvp of result.value) {
            const isPast = rsvp.event.startDatetime < now;
            const isCancelled = rsvp.status === "cancelled";

            if (isPast || isCancelled) {
                pastCancelled.push(rsvp);
            } else {
                const conflictsResult = await this.rsvpRepo.findOverlappingActiveRsvps(
                    userId,
                    rsvp.eventId,
                    rsvp.event.startDatetime,
                    rsvp.event.endDatetime,
                );

                if (conflictsResult.ok === false) {
                    return Err(UnexpectedDependencyError(conflictsResult.value.message));
                }

                const conflictWarning = conflictsResult.value.length > 0 ? `Conflicts with ${conflictsResult.value[0].event.title}` : null;
                upcoming.push({...rsvp, conflictWarning,});
            }
        }

        const sortDesc = (a: RSVPWithEvent, b: RSVPWithEvent) =>
            b.createdAt.getTime() - a.createdAt.getTime();

        upcoming.sort(sortDesc);
        pastCancelled.sort(sortDesc);

        return Ok({
            upcoming,
            pastCancelled,
        });
    }

    async getRSVPsByEvent(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IAttendeeGroups, GetRsvpsByEventError>> {
        const eventResult = await this.eventRepo.findById(eventId);

        if (eventResult.ok === false) {
            return Err(UnexpectedDependencyError(eventResult.value.message));
        }

        const event = eventResult.value;

        if (!event) {
            return Err(EventNotFoundError(`Event ${eventId} not found`));
        }

        if (actingUserRole === "user") {
            return Err(NotAuthorizedError("Users cannot view attendee lists"));
        }

        if (actingUserRole === "staff" && event.organizerId !== actingUserId) {
            return Err(NotAuthorizedError("Staff can only view attendees for their own events"));
        }

        this.logger.info(`Fetching RSVPs for event ${eventId}`);
        const rsvpsResult = await this.rsvpRepo.findAttendeesByEventId(eventId);

        if (rsvpsResult.ok === false ) {
            return Err(UnexpectedDependencyError(rsvpsResult.value.message));
        }

        const grouped: IAttendeeGroups = {
            going: [],
            waitlisted: [],
            cancelled: [],
        };

        for (const rsvp of rsvpsResult.value) {
            grouped[rsvp.status].push(rsvp);
        }
        return Ok(grouped);
    }

    async toggleRSVP(
        eventId: string,
        actingUserId: string,
        actingUserRole: UserRole,
    ): Promise<Result<IToggleRSVPResult, ToggleRsvpError>> {
        if (actingUserRole === "staff" || actingUserRole === "admin") {
            return Err(InvalidRSVPError("Organizers and admins cannot RSVP to events"));
        }

        const eventResult = await this.eventRepo.findById(eventId);

        if (eventResult.ok === false) {
            return Err(UnexpectedDependencyError(eventResult.value.message));
        }

        const event = eventResult.value;

        if (!event) {
            return Err(EventNotFoundError(`Event ${eventId} not found`));
        }

        if (event.status === "cancelled" || event.status === "past") {
            return Err(InvalidRSVPError("Cannot RSVP to a cancelled or past event"));
        }

        const existingResult = await this.rsvpRepo.findByUserAndEvent(actingUserId, eventId);

        if (existingResult.ok === false) {
            return Err(UnexpectedDependencyError(existingResult.value.message));
        }

        const existing = existingResult.value;

        if (existing !== null && (existing.status === "going" || existing.status === "waitlisted")) {
            const updated: RSVP = {
                id: existing.id,
                eventId: existing.eventId,
                userId: existing.userId,
                status: "cancelled",
                createdAt: existing.createdAt,
            };

            const saveResult = await this.rsvpRepo.save(updated);

            if (saveResult.ok === false) {
                return Err(UnexpectedDependencyError(saveResult.value.message));
            }

            this.logger.info(`User ${actingUserId} cancelled RSVP for event ${eventId}`);
            
            return Ok({
                rsvp: updated,
                conflicts: [],
            });
        }

        const countResult = await this.rsvpRepo.countGoing(eventId);

        if (countResult.ok === false) {
            return Err(UnexpectedDependencyError(countResult.value.message));
        }

        const isFull = event.capacity !== null && countResult.value >= event.capacity;
        const newStatus = isFull ? "waitlisted" : "going";

        const rsvp: RSVP =
            existing !== null
                ? {
                    id: existing.id,
                    eventId: existing.eventId,
                    userId: existing.userId,
                    status: newStatus,
                    createdAt: existing.createdAt,
                }
                : {
                    id: `rsvp-${Date.now()}`,
                    eventId,
                    userId: actingUserId,
                    status: newStatus,
                    createdAt: new Date(),
                };

        const saveResult = await this.rsvpRepo.save(rsvp);

        if (saveResult.ok === false) {
            return Err(UnexpectedDependencyError(saveResult.value.message));
        }

        const conflictsResult = await this.rsvpRepo.findOverlappingActiveRsvps(
            actingUserId,
            eventId,
            event.startDatetime,
            event.endDatetime,
        );

        if (conflictsResult.ok === false) {
            return Err(UnexpectedDependencyError(conflictsResult.value.message));
        }

        this.logger.info(`User ${actingUserId} RSVP'd ${newStatus} for event ${eventId}`);

        return Ok({
            rsvp,
            conflicts: conflictsResult.value,
        });
    }

    async getAttendeeCount(eventId: string): Promise<Result<number, GetAttendeeCountError>> {
        const eventResult = await this.eventRepo.findById(eventId);

        if (eventResult.ok === false) {
            return Err(UnexpectedDependencyError(eventResult.value.message));
        }

        const event = eventResult.value;

        if (!event) {
            return Err(EventNotFoundError(`Event ${eventId} not found`));
        }

        const countResult = await this.rsvpRepo.countGoing(eventId);

        if (countResult.ok === false) {
            return Err(UnexpectedDependencyError(countResult.value.message));
        }

        return Ok(countResult.value);
    }
}

export function CreateRsvpService(
    rsvpRepo: IRSVPRepository,
    eventRepo: IEventRepository,
    logger: ILoggingService,
): IRsvpService {
    return new RsvpService(rsvpRepo, eventRepo, logger);
}
