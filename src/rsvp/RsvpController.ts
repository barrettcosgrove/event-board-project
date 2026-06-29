import type { Request, Response } from "express";
import type { IRsvpService } from "./RsvpService";
import type { ILoggingService } from "../service/LoggingService";
import type { IAppBrowserSession } from "../session/AppSession";
import type { RSVPError } from "./errors";
import type { EventError } from "../events/errors";
import type { IEventService } from "../events/EventService";
import type { UserRole } from "../auth/User";

export interface IRsvpController {
    showMyRsvps(res: Response, session: IAppBrowserSession): Promise<void>;
    toggleRsvp(
        req: Request,
        res: Response,
        eventId: string,
        session: IAppBrowserSession,
    ): Promise<void>;
    showEventAttendees(
        req: Request,
        res: Response,
        eventId: string,
        session: IAppBrowserSession,
    ): Promise<void>;
}

class RsvpController implements IRsvpController {
    constructor(
        private readonly service: IRsvpService,
        private readonly eventService: IEventService,
        private readonly logger: ILoggingService,
    ) { }

    private mapErrorStatus(error: RSVPError | EventError): number {
        switch (error.name) {
            case "EventNotFoundError":
                return 404;

            case "NotAuthorizedError":
                return 403;

            case "InvalidRSVPError":
            case "InvalidEventStateError":
            case "InvalidInputError":
                return 400;

            case "UnexpectedDependencyError":
                return 500;

            default:
                return 500;
        }
    }

    async showMyRsvps(res: Response, session: IAppBrowserSession): Promise<void> {
        const userId = session.authenticatedUser!.userId
        const result = await this.service.getDashboardRSVPs(userId);

        if (result.ok === false) {
            const status = this.mapErrorStatus(result.value)
            this.logger.error(`showMyRsvps failed: ${result.value.message}`)
            res.status(status).render("partials/error", { message: result.value.message, layout: false })
            return;
        }

        res.render("rsvps/dashboard", { upcoming: result.value.upcoming, pastCancelled: result.value.pastCancelled, session, pageError: null });
    }

    async toggleRsvp(req: Request, res: Response, eventId: string, session: IAppBrowserSession): Promise<void> {
        const { userId, role } = session.authenticatedUser!;
        const result = await this.service.toggleRSVP(eventId, userId, role);

        if (result.ok === false) {
            const status = this.mapErrorStatus(result.value);
            this.logger.warn(`toggleRsvp failed: ${result.value.message}`);
            res.status(status).render("partials/error", {
                message: result.value.message,
                layout: false,
            });
            return;
        }

        this.logger.info(`User ${userId} toggled RSVP for event ${eventId} - status: ${result.value.rsvp.status}`);

        let rsvpMessage = "";

        if (result.value.rsvp.status === "going") {
            rsvpMessage = "You have successfully RSVPed to this event.";
        } else if (result.value.rsvp.status === "waitlisted") {
            rsvpMessage = "This event is full. You have been added to the waitlist.";
        } else if (result.value.rsvp.status === "cancelled") {
            rsvpMessage = "Your RSVP has been cancelled.";
        }

        let overlapWarning: string | null = null;

        if (result.value.conflicts.length > 0) {
            const conflictList = result.value.conflicts
                .map((conflict) => {
                    const event = conflict.event;
                    return `${event.title} from ${event.startDatetime.toLocaleString()} to ${event.endDatetime.toLocaleString()}`;
                })
                .join("; ");

            overlapWarning = `This event overlaps with: ${conflictList}.`;
        }

        const hxHeader = req.get("HX-Request");
        const isHtmxRequest = hxHeader === "true";

        this.logger.info(`HX-Request header: ${hxHeader ?? "missing"}`);

        if (isHtmxRequest) {
            this.logger.info("HTMX request detected -> returning partial RSVP section");

            const detailResult = await this.eventService.getEventDetailView(
                eventId,
                userId,
                role as UserRole,
            );

            if (detailResult.ok === false) {
                const status = this.mapErrorStatus(detailResult.value);
                res.status(status).render("partials/error", {
                    message: detailResult.value.message,
                    layout: false,
                });
                return;
            }

            const userRSVPResult = await this.service.getRSVPsByUser(userId);
            let userRSVP = null;

            if (userRSVPResult.ok) {
                const match = userRSVPResult.value.find((r) => r.eventId === eventId);
                userRSVP = match ?? null;
            }

            res.render("events/partials/rsvp-section", {
                event: detailResult.value.event,
                attendeeCount: detailResult.value.attendeeCount,
                user: session.authenticatedUser,
                userRSVP,
                rsvpMessage,
                overlapWarning,
                layout: false,
            });
            return;
        }

        this.logger.info("Standard request detected -> redirecting for full page reload");
        const params = new URLSearchParams({
            rsvpMessage,
        });

        if (overlapWarning) {
            params.set("overlapWarning", overlapWarning);
        }

        res.redirect(`/events/${eventId}?${params.toString()}`);
    }

    async showEventAttendees(
        req: Request,
        res: Response,
        eventId: string,
        session: IAppBrowserSession,
    ): Promise<void> {
        const { userId: userId, role } = session.authenticatedUser!;
        const isHtmxRequest = req.get("HX-Request") === "true";

        const result = await this.service.getRSVPsByEvent(eventId, userId, role);

        if (result.ok === false) {
            const status = this.mapErrorStatus(result.value);
            this.logger.warn(`showEventAttendees failed: ${result.value.message}`);
            res.status(status).render("partials/error", { message: result.value.message, layout: false });
            return;
        }

        this.logger.info(`Loaded attendee list for event ${eventId}`);
        res.render("rsvps/attendees", {
            attendees: result.value,
            eventId,
            session,
            layout: isHtmxRequest ? false : undefined,
        });
    }
}

export function CreateRsvpController(
    service: IRsvpService,
    eventService: IEventService,
    logger: ILoggingService,
): IRsvpController {
    return new RsvpController(service, eventService, logger);
}
