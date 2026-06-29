import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import { IEventController } from "./events/EventController";
import {
  AuthenticationRequired,
  AuthorizationRequired,
} from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import {
  getAuthenticatedUser,
  isAuthenticatedSession,
  AppSessionStore,
  recordPageView,
  touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";
import { IRsvpController } from "./rsvp/RsvpController";

type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
  return function wrapped(req: Request, res: Response, next: (value?: unknown) => void) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
  private readonly app: express.Express;

  constructor(
    private readonly authController: IAuthController,
    private readonly eventController: IEventController,
    private readonly rsvpController: IRsvpController,
    private readonly logger: ILoggingService,
  ) {
    this.app = express();
    this.registerMiddleware();
    this.registerTemplating();
    this.registerRoutes();
  }

  private registerMiddleware(): void {
    // Serve static files from src/static (create this directory to add your own assets)
    this.app.use(express.static(path.join(process.cwd(), "src/static")));
    this.app.use(
      session({
        name: "app.sid",
        secret: process.env.SESSION_SECRET ?? "project-starter-demo-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: "lax",
        },
      }),
    );
    this.app.use(Layouts);
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use((req, res, next) => {
      res.locals.currentPath = req.path;
      next();
    });
  }

  private registerTemplating(): void {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(process.cwd(), "src/views"));
    this.app.set("layout", "layouts/base");
  }

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  /**
   * Middleware helper: returns true if the request is from an authenticated user.
   * If the user is not authenticated, it handles the response (redirect or 401).
   */
  private requireAuthenticated(req: Request, res: Response): boolean {
    const store = sessionStore(req);
    touchAppSession(store);

    if (getAuthenticatedUser(store)) {
      return true;
    }

    this.logger.warn("Blocked unauthenticated request to a protected route");
    if (this.isHtmxRequest(req) || req.method !== "GET") {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return false;
    }

    res.redirect("/login");
    return false;
  }

  /**
   * Middleware helper: returns true if the authenticated user has one of the
   * allowed roles. Calls requireAuthenticated first, so unauthenticated
   * requests are handled automatically.
   */
  private requireRole(
    req: Request,
    res: Response,
    allowedRoles: UserRole[],
    message: string,
  ): boolean {
    if (!this.requireAuthenticated(req, res)) {
      return false;
    }

    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (currentUser && allowedRoles.includes(currentUser.role)) {
      return true;
    }

    this.logger.warn(
      `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
    );
    res.status(403).render("partials/error", {
      message: AuthorizationRequired(message).message,
      layout: false,
    });
    return false;
  }

  private registerRoutes(): void {
    // ── Public routes ────────────────────────────────────────────────

    this.app.get(
      "/",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /");
        const store = sessionStore(req);
        res.redirect(isAuthenticatedSession(store) ? "/events" : "/login");
      }),
    );

    this.app.get(
      "/login",
      asyncHandler(async (req, res) => {
        const store = sessionStore(req);
        const browserSession = recordPageView(store);

        if (getAuthenticatedUser(store)) {
          res.redirect("/events");
          return;
        }

        await this.authController.showLogin(res, browserSession);
      }),
    );

    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const email = typeof req.body.email === "string" ? req.body.email : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        await this.authController.loginFromForm(res, email, password, sessionStore(req));
      }),
    );

    this.app.post(
      "/logout",
      asyncHandler(async (req, res) => {
        await this.authController.logoutFromForm(res, sessionStore(req));
      }),
    );

    // ── Admin routes ─────────────────────────────────────────────────

    this.app.get(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.authController.showAdminUsers(res, browserSession);
      }),
    );

    this.app.post(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const roleValue = typeof req.body.role === "string" ? req.body.role : "user";
        const role: UserRole =
          roleValue === "admin" || roleValue === "staff" || roleValue === "user"
            ? roleValue
            : "user";

        await this.authController.createUserFromForm(
          res,
          {
            email: typeof req.body.email === "string" ? req.body.email : "",
            displayName:
              typeof req.body.displayName === "string" ? req.body.displayName : "",
            password: typeof req.body.password === "string" ? req.body.password : "",
            role,
          },
          touchAppSession(sessionStore(req)),
        );
      }),
    );

    this.app.post(
      "/admin/users/:id/delete",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (!currentUser) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired("Please log in to continue.").message,
            layout: false,
          });
          return;
        }

        await this.authController.deleteUserFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          currentUser.userId,
          session,
        );
      }),
    );

    // ── Authenticated home page ──────────────────────────────────────

    this.app.get(
      "/home",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        this.logger.info(`GET /home for ${browserSession.browserLabel}`);
        res.redirect("/events");
      }),
    );

    // -- RSVP routes
    this.app.get(
      "/rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;

        const user = getAuthenticatedUser(sessionStore(req));

        if (!user || user.role !== "user") {
          this.logger.warn("Blocked non-member access to RSVP dashboard");
          res.status(403).render("partials/error", {
            message: "Only members can access their RSVP dashboard.",
            layout: false,
          });
          return;
        }

        const store = sessionStore(req);
        const session = recordPageView(store);
        await this.rsvpController.showMyRsvps(res, session);
      }),
    );

    // -- Event routes --
    // Static paths first — no params

    this.app.get(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        this.logger.info("GET /events");
        await this.eventController.showEventsList(req, res);
      }),
    );

    this.app.get(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        this.logger.info("GET /events/new");
        await this.eventController.showCreateForm(req, res);
      }),
    );

    this.app.get(
      "/events/dashboard",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin", "staff"], "Only organizers can view the dashboard.")
        ) {
          return;
        }

        this.logger.info("GET /events/dashboard");
        await this.eventController.showOrganizerDashboard(req, res);
      }),
    );

    // Param routes (catch-all /events/:eventId last)

    this.app.get(
      "/events/:eventId/attendees",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        this.logger.info(`GET /events/${req.params.eventId}/attendees`);
        const browserSession = touchAppSession(sessionStore(req));
        const eventId = req.params.eventId as string;
        await this.rsvpController.showEventAttendees(req, res, eventId, browserSession);
      }),
    );

    this.app.get(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        this.logger.info(`GET /events/${req.params.id}/edit`);
        await this.eventController.showEditForm(req, res);
      }),
    );

    this.app.get(
      "/events/:eventId",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        await this.eventController.showEventDetail(req, res);
      }),
    );

    // POST routes

    this.app.post(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        this.logger.info("POST /events/new");
        await this.eventController.handleCreateForm(req, res);
      }),
    );

    this.app.post(
      "/events/:eventId/rsvp",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }
        const browserSession = touchAppSession(sessionStore(req));
        const eventId = req.params.eventId as string;
        await this.rsvpController.toggleRsvp(req, res, eventId, browserSession);
      }),
    );

    this.app.post(
      "/events/:id/publish",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin", "staff"], "Only admins and staff can manage events.")
        ) {
          return;
        }
        this.logger.info(`POST /events/${req.params.id}/publish`);
        await this.eventController.publishEvent(req, res);
      }),
    );

    this.app.post(
      "/events/:id/cancel",
      asyncHandler(async (req, res) => {
        if (
          !this.requireRole(req, res, ["admin", "staff"], "Only admins and staff can manage events.")
        ) {
          return;
        }
        this.logger.info(`POST /events/${req.params.id}/cancel`);
        await this.eventController.cancelEvent(req, res);
      }),
    );

    this.app.post(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        this.logger.info(`POST /events/${req.params.id}/edit`);
        await this.eventController.handleEditForm(req, res);
      }),
    );

    // ── Error handler ────────────────────────────────────────────────

    this.app.use((err: unknown, _req: Request, res: Response, _next: (value?: unknown) => void) => {
      const message = err instanceof Error ? err.message : "Unexpected server error.";
      this.logger.error(message);
      res.status(500).render("partials/error", {
        message: "Unexpected server error.",
        layout: false,
      });
    });
  }

  getExpressApp(): express.Express {
    return this.app;
  }
}

export function CreateApp(
  authController: IAuthController,
  eventController: IEventController,
  rsvpController: IRsvpController,
  logger: ILoggingService,
): IApp {
  return new ExpressApp(authController, eventController, rsvpController, logger);
}
