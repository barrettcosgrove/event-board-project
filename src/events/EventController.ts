import type { Request, Response } from "express";
import { getAuthenticatedUser, recordPageView, type AppSessionStore } from "../session/AppSession";
import type { IEventService } from "./EventService";
import type { ILoggingService } from "../service/LoggingService";
import type { IRSVPRepository } from "../rsvp/RsvpRepository";
import type { UserRole } from "../auth/User";
import type { EventError } from "./errors";
import { isEventCategory, isEventTimeframe } from "./Event";

export interface IEventController {
  showCreateForm(req: Request, res: Response): void;
  handleCreateForm(req: Request, res: Response): Promise<void>;
  showEventDetail(req: Request, res: Response): Promise<void>;
  showEditForm(req: Request, res: Response): Promise<void>;
  handleEditForm(req: Request, res: Response): Promise<void>;
  showEventsList(req: Request, res: Response): Promise<void>;
  publishEvent(req: Request, res: Response): Promise<void>;
  cancelEvent(req: Request, res: Response): Promise<void>;
  showOrganizerDashboard(req: Request, res: Response): Promise<void>;
}

function parseCapacity(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function parseDate(raw: string): Date {
  return new Date(raw);
}

export class EventController implements IEventController {
  constructor(
    private readonly eventService: IEventService,
    private readonly rsvpRepository: IRSVPRepository,
    private readonly logger: ILoggingService,
  ) { }

  private mapErrorStatus(error: EventError): number {
    if (error.name === "InvalidInputError") return 400;
    if (error.name === "InvalidSearchQueryError") return 400;
    if (error.name === "EventNotFoundError") return 404;
    if (error.name === "NotAuthorizedError") return 403;
    if (error.name === "InvalidEventStateError") return 400;
    return 500;
  }

  showCreateForm(req: Request, res: Response): void {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    if (user.role === "user") {
      res.status(403).render("partials/error", {
        message: "Only organizers and admins can create events.",
        layout: false,
      });
      return;
    }

    const browserSession = recordPageView(store);

    res.render("events/create", {
      session: browserSession,
      pageError: null,
      formData: {},
    });
  }

  async handleCreateForm(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    const rawCapacity =
      typeof req.body.capacity === "string" ? req.body.capacity : "";

    const formData = {
      title: typeof req.body.title === "string" ? req.body.title : "",
      description:
        typeof req.body.description === "string" ? req.body.description : "",
      location:
        typeof req.body.location === "string" ? req.body.location : "",
      category:
        typeof req.body.category === "string" ? req.body.category : "",
      capacity: parseCapacity(rawCapacity),
      startDatetime: parseDate(
        typeof req.body.startDatetime === "string"
          ? req.body.startDatetime
          : ""
      ),
      endDatetime: parseDate(
        typeof req.body.endDatetime === "string"
          ? req.body.endDatetime
          : ""
      ),
    };

    const result = await this.eventService.createEvent(
      user.userId,
      user.role,
      formData
    );

    if (result.ok === false) {
      const error = result.value;

      if (error.name === "NotAuthorizedError") {
        res.status(403).render("partials/error", {
          message: error.message,
          layout: false,
        });
        return;
      }

      if (error.name === "InvalidInputError") {
        res.status(400).render("events/create", {
          session: recordPageView(store),
          pageError: error.message,
          formData: {
            ...req.body,
            capacity: rawCapacity,
          },
        });
        return;
      }

      // fallback
      res.status(500).render("partials/error", {
        message: "Something went wrong.",
        layout: false,
      });
      return;
    }

    if (req.get("HX-Request") === "true") {
      res.set("HX-Redirect", `/events/${result.value.id}`);
      res.status(204).send();
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }

  async showEventDetail(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    const browserSession = recordPageView(store);
    const eventId = req.params.eventId as string;

    const detailResult = await this.eventService.getEventDetailView(
      eventId,
      user.userId,
      user.role as UserRole
    );

    if (detailResult.ok === false) {
      const status = this.mapErrorStatus(detailResult.value);

      res.status(status).render("partials/error", {
        message: detailResult.value.message,
        layout: false,
      });
      return;
    }

    const userRSVPResult = await this.rsvpRepository.findByUserAndEvent(
      user.userId,
      eventId
    );

    const userRSVP = userRSVPResult.ok ? userRSVPResult.value : null;

    const rsvpMessage = typeof req.query.rsvpMessage === "string" ? req.query.rsvpMessage : null;

    let overlapWarning = typeof req.query.overlapWarning === "string" ? req.query.overlapWarning : null;

    if (
      userRSVP &&
      (userRSVP.status === "going" || userRSVP.status === "waitlisted")
    ) {
      const overlapsResult = await this.rsvpRepository.findOverlappingActiveRsvps(
        user.userId,
        eventId,
        detailResult.value.event.startDatetime,
        detailResult.value.event.endDatetime,
      );

      if (overlapsResult.ok) {
        if (overlapsResult.value.length > 0) {
          const conflictList = overlapsResult.value
            .map((conflict) => {
              const event = conflict.event;
              return `${event.title} from ${event.startDatetime.toLocaleString()} to ${event.endDatetime.toLocaleString()}`;
            })
            .join("; ");
          overlapWarning = `This event overlaps with: ${conflictList}.`;
        } else {
          overlapWarning = null;
        }
      }
    }

    res.render("events/detail", {
      session: browserSession,
      title: detailResult.value.event.title,
      event: detailResult.value.event,
      attendeeCount: detailResult.value.attendeeCount,
      user,
      userRSVP,
      rsvpMessage,
      overlapWarning,
    });
  }

  async showEditForm(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    if (user.role === "user") {
      res.status(403).render("partials/error", {
        message: "Only organizers and admins can edit events.",
        layout: false,
      });
      return;
    }

    const browserSession = recordPageView(store);
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    const eventResult = await this.eventService.getEventById(
      eventId,
      user.userId,
      user.role as UserRole
    );

    if (eventResult.ok === false) {
      const error = eventResult.value;
      const status = this.mapErrorStatus(error);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    const event = eventResult.value;

    const formatDatetime = (date: Date): string => {
      const d = new Date(date);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    res.render("events/edit", {
      session: browserSession,
      pageError: null,
      eventId,
      formData: {
        title: event.title,
        description: event.description,
        location: event.location,
        category: event.category,
        capacity: event.capacity ?? "",
        startDatetime: formatDatetime(event.startDatetime),
        endDatetime: formatDatetime(event.endDatetime),
      },
    });
  }

  async handleEditForm(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    const eventId = typeof req.params.id === "string" ? req.params.id : "";
    const rawCapacity = typeof req.body.capacity === "string" ? req.body.capacity : "";

    const data: Partial<{
      title: string;
      description: string;
      location: string;
      category: string;
      capacity: number | null;
      startDatetime: Date;
      endDatetime: Date;
    }> = {};

    if (req.body.title) data.title = req.body.title;
    if (req.body.description) data.description = req.body.description;
    if (req.body.location) data.location = req.body.location;
    if (req.body.category) data.category = req.body.category;
    if (req.body.capacity !== undefined) data.capacity = parseCapacity(rawCapacity);
    if (req.body.startDatetime) data.startDatetime = parseDate(req.body.startDatetime);
    if (req.body.endDatetime) data.endDatetime = parseDate(req.body.endDatetime);

    const result = await this.eventService.updateEvent(
      eventId,
      user.userId,
      user.role,
      data
    );

    if (result.ok === false) {
      const error = result.value;

      if (error.name === "NotAuthorizedError") {
        res.status(403).render("partials/error", {
          message: error.message,
          layout: false,
        });
        return;
      }

      if (error.name === "EventNotFoundError") {
        res.status(404).render("partials/error", {
          message: error.message,
          layout: false,
        });
        return;
      }

      if (error.name === "InvalidEventStateError") {
        res.status(400).render("partials/error", {
          message: error.message,
          layout: false,
        });
        return;
      }

      res.status(400).render("events/edit", {
        session: recordPageView(store),
        pageError: error.message,
        eventId,
        formData: { ...req.body, capacity: rawCapacity },
      });
      return;
    }

    res.redirect(`/events/${result.value.id}`);
  }

  async showEventsList(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    const browserSession = recordPageView(store);
    const isHtmxRequest = req.get("HX-Request") === "true";

    const rawCategory =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const rawTimeframe =
      typeof req.query.timeframe === "string" ? req.query.timeframe : undefined;
    const searchQuery =
      typeof req.query.searchQuery === "string" ? req.query.searchQuery : undefined;

    const category = rawCategory && isEventCategory(rawCategory)
      ? rawCategory
      : undefined;

    const timeframe = rawTimeframe && isEventTimeframe(rawTimeframe)
      ? rawTimeframe
      : undefined;

    const result = await this.eventService.listEvents(
      user.userId,
      user.role,
      {
        category,
        timeframe,
        searchQuery,
      },
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Failed to list events: ${result.value.message}`);

      if (isHtmxRequest) {
        res.status(status).render("partials/error", {
          message: result.value.message,
          layout: false,
        });
        return;
      }

      res.status(status).render("events/list", {
        session: browserSession,
        events: [],
        activeCategory: category ?? "",
        activeTimeframe: timeframe ?? "all",
        searchQuery: searchQuery ?? "",
        pageError: result.value.message,
      });
      return;
    }

    if (isHtmxRequest) {
      res.render("events/results", {
        events: result.value,
        layout: false,
      });
      return;
    }

    res.render("events/list", {
      session: browserSession,
      events: result.value,
      activeCategory: category ?? "",
      activeTimeframe: timeframe ?? "all",
      searchQuery: searchQuery ?? "",
      pageError: null,
    });
  }

  async publishEvent(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login")
      return;
    }

    const isHtmxRequest = req.get("HX-Request") === "true"
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    const result = await this.eventService.updateEventStatus(eventId, user.userId, user.role, "published");

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);

      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    if (isHtmxRequest){
      res.render("events/partials/event-status-controls", {
        event: result.value,
        layout: false
      });
      return;
    }

    res.redirect("/events/dashboard");
  }

  async cancelEvent(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    const isHtmxRequest = req.get("HX-Request") === "true"
    const eventId = typeof req.params.id === "string" ? req.params.id : "";

    const result = await this.eventService.updateEventStatus(eventId, user.userId, user.role, "cancelled");

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);

      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    if (isHtmxRequest){
      res.render("events/partials/event-status-controls", {
        event: result.value,
        layout: false
      });
      return;
    }

    res.redirect("/events/dashboard");
  }

  async showOrganizerDashboard(req: Request, res: Response): Promise<void> {
    const store = req.session as AppSessionStore;
    const user = getAuthenticatedUser(store);

    if (!user) {
      res.redirect("/login");
      return;
    }

    if (user.role === "user") {
      res.status(403).render("partials/error", {
        message: "You are not authorized to view this page.",
        layout: false,
      });
      return;
    }

    const browserSession = recordPageView(store);
    const result = await this.eventService.getAllEventsForOrganizer(
      user.userId,
      user.role
    );

    if (result.ok === false) {
      const status = this.mapErrorStatus(result.value);
      const log = status >= 500 ? this.logger.error : this.logger.warn;
      log.call(this.logger, `Failed to load organizer dashboard: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    const now = new Date()
    const published = result.value.filter(
      (e) => e.status === "published" && e.endDatetime > now
    );

    const draft = result.value.filter((e) => e.status === "draft");
    const cancelledOrPast = result.value.filter(
      (e) => e.status === "cancelled" || e.endDatetime < now
    );

    res.render("events/dashboard", {
      session: browserSession,
      published,
      draft,
      cancelledOrPast,
      user,
      pageError: null,
    })
  }
}

export function CreateEventController(
  eventService: IEventService,
  rsvpRepository: IRSVPRepository,
  logger: ILoggingService,
): IEventController {
  return new EventController(eventService, rsvpRepository, logger);
}
