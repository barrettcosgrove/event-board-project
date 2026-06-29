import type { Result } from "../lib/result";
import type { RSVP, RSVPAttendee, RSVPConflict, RSVPWithEvent } from "./RSVP";
import type { RSVPError } from "./errors"

export interface IRSVPRepository {
    findByUser(userId: string): Promise<Result<RSVPWithEvent[], RSVPError>>;
    findByEventId(eventId: string): Promise<Result<RSVP[], RSVPError>>;
    findAttendeesByEventId(eventId: string): Promise<Result<RSVPAttendee[], RSVPError>>;
    findByUserAndEvent(userId: string, eventId: string): Promise<Result<RSVP | null, RSVPError>>;
    findOverlappingActiveRsvps(userId: string, eventId: string, startDatetime: Date, endDatetime: Date): Promise<Result<RSVPConflict[], RSVPError>>;
    countGoing(eventId: string): Promise<Result<number, RSVPError>>;
    save(rsvp: RSVP): Promise<Result<RSVP, RSVPError>>;
}
