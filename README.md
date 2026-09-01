# Local Event Board

## Description
Local Event Board is a role-based event management application that lets organizers create and manage events while giving members a simple way to browse listings, filter by category and date, and RSVP to upcoming activities. The platform is designed to support admin, staff, and user workflows with protected access, attendee tracking, event publishing, and conflict-aware RSVP handling.

## Overview
This project is designed for a small organization or community group that needs a simple but structured way to manage events and attendance online. Instead of relying on a generic scheduling tool, Local Event Board centers the workflow around a few clear roles: admins manage the platform, staff organize and publish events, and members browse upcoming activities and respond to invitations.

The experience is intentionally lightweight and local-first. Events are easy to create and update, filtered quickly by category and date, and presented in a dashboard-friendly interface that supports RSVP decisions, conflict awareness, and attendance visibility. The app combines a server-rendered interface with interactive UI enhancements so it feels responsive without becoming overly complex.

## Demo
A local demo is available by running the app and visiting:

- https://localhost:3443

> The app is served over HTTPS with a self-signed certificate for local development. Your browser will show a certificate warning the first time, which you can accept to continue.

### Demo accounts
The seeded application includes the following demo users:

| Email | Display Name | Role | Password |
| --- | --- | --- | --- |
| admin@app.test | Avery Admin | admin | password123 |
| staff@app.test | Sam Staff | staff | password123 |
| user@app.test | Una User | user | password123 |

### Screenshot
A polished product screenshot will be added here later once the UI is finalized for presentation.

## Key Features

- Role-based access control for admins, staff organizers, and regular members
- Event creation, editing, publishing, and cancellation flows
- Event search and filtering by category, date range, and status
- Detailed event pages with organizer metadata and attendee counts
- RSVP toggling with waitlist logic and conflict detection for overlapping events
- Organizer dashboard to track event performance and ownership
- Attendee listing grouped by RSVP status for each event
- Session-based authentication and secure local HTTPS setup
- SQLite-backed persistence through Prisma for reliable local development

## Tech Stack

### Languages
- TypeScript
- SQL (Prisma schema + SQLite database)
- HTML / EJS templates
- CSS utility classes via Tailwind

### Frameworks and runtime
- Node.js
- Express.js
- EJS with express-ejs-layouts
- Prisma ORM

### Database
- SQLite via Prisma
- Prisma migrations and schema management

### Key libraries and tools
- `@prisma/client` + `prisma`
- `better-sqlite3` with Prisma adapter
- `express-session` for authenticated sessions
- `dotenv` for environment configuration
- `supertest` and `jest` for testing
- `ts-jest` and `ts-node` for TypeScript test and dev execution
- Tailwind CSS via CDN
- Alpine.js and HTMX for interactive UI behavior

## Getting Started

### Prerequisites
- Node.js 18 or newer
- npm
- Git

### Installation

```bash
git clone <repository-url>
cd team1-event-board
npm install
```

### Database setup

Generate Prisma client and create/apply the local SQLite schema:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

If you want to seed the app with demo users and sample events, run:

```bash
npx ts-node prisma/seed.ts
```

### Run locally

```bash
npm run dev
```

Then open:

```text
https://localhost:3443
```

The app automatically redirects traffic from http://localhost:3000 to the HTTPS endpoint.

## Project Scripts

```bash
npm run dev         # Build TypeScript and start the app
npm run build       # Compile the project to dist/
npm test           # Run the Jest suite
npm run test:watch  # Run Jest in watch mode
npx prisma generate # Regenerate Prisma client
npx prisma migrate dev --name init # Apply migrations
```

## Project Architecture

The application follows a layered architecture that separates HTTP concerns, business logic, and data access.

### 1. Presentation layer
The Express app in [src/app.ts](src/app.ts) wires up middleware, session management, EJS rendering, and route registration. The UI is rendered with EJS templates under [src/views](src/views), and the shared shell layout lives in [src/views/layouts/base.ejs](src/views/layouts/base.ejs).

### 2. Controller layer
Controllers handle request parsing and coordinate between the web layer and the service layer. Examples include:
- [src/auth/AuthController.ts](src/auth/AuthController.ts)
- [src/events/EventController.ts](src/events/EventController.ts)
- [src/rsvp/RsvpController.ts](src/rsvp/RsvpController.ts)

These controllers validate inputs, enforce access rules, and render the appropriate views or responses.

### 3. Service layer
Business rules live in service classes such as:
- [src/auth/AuthService.ts](src/auth/AuthService.ts)
- [src/auth/AdminUserService.ts](src/auth/AdminUserService.ts)
- [src/events/EventService.ts](src/events/EventService.ts)
- [src/rsvp/RsvpService.ts](src/rsvp/RsvpService.ts)

This layer contains the core application logic, including validation, organizer permissions, RSVP transitions, and event status changes.

### 4. Repository layer
The repository layer abstracts storage implementation details. The project supports both in-memory and Prisma-backed persistence through interfaces and implementations such as:
- [src/events/EventRepository.ts](src/events/EventRepository.ts)
- [src/events/PrismaEventRepository.ts](src/events/PrismaEventRepository.ts)
- [src/rsvp/RsvpRepository.ts](src/rsvp/RsvpRepository.ts)
- [src/rsvp/PrismaRsvpRepository.ts](src/rsvp/PrismaRsvpRepository.ts)

The composition layer in [src/composition.ts](src/composition.ts) decides which implementation to inject, so the app can switch between local in-memory data and SQLite-backed Prisma storage.

### 5. Data and persistence
The schema in [prisma/schema.prisma](prisma/schema.prisma) defines the application’s core models:
- `User`
- `Event`
- `RSVP`

The app stores this data in a SQLite database and uses Prisma migrations and the Prisma client for queries and schema management.

### 6. Shared utilities and domain conventions
Cross-cutting logic is centralized in files such as:
- [src/lib/result.ts](src/lib/result.ts)
- [src/session/AppSession.ts](src/session/AppSession.ts)
- [src/service/LoggingService.ts](src/service/LoggingService.ts)

This keeps validation, session management, and result handling consistent across the application.

## Notes

This project is intended as a local event board for development and demonstration. It uses a self-signed certificate for HTTPS in development, so browser certificate warnings are expected the first time you connect.

The app is structured around a service/repository pattern and role-aware controllers, making it easy to extend with additional event features or alternate storage backends in the future.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `HTTPS_PORT` | `3443` | HTTPS listener port |
| `HTTP_REDIRECT_PORT` | `3000` | HTTP-to-HTTPS redirect port |
| `HTTPS_KEY_PATH` | `./certs/localhost-key.pem` | Path to TLS private key |
| `HTTPS_CERT_PATH` | `./certs/localhost-cert.pem` | Path to TLS certificate |
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite database path |
| `SESSION_SECRET` | `project-starter-demo-secret` | Session signing secret |
