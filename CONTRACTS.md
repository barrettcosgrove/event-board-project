# CONTRACTS.md — Local Event Board

Interface contracts for every service method shared across two or more features.
Agreed upon before Sprint 1 development begins.

**Team assignments:**
- Athena Yung — Features 1, 3
- Anusha Arokiaraj — Features 2, 4
- Barrett — Features 5, 6
- Chau Tran — Features 7, 8
- Rayan Chahid — Features 10, 12

**Integration Compromise rule:** If you change a method's return shape after a teammate has built against it, that is a −10 point penalty on your individual sprint score. Communicate *before* you change anything documented here.

---
## Shared Result Pattern

All shared service methods return a `Result<T, E>` shape.

### Success
```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```
---

## SharedTypes

```ts
type UserRole = "admin" | "staff" | "user";
```
```ts
type EventStatus = "draft" | "published" | "cancelled" | "past";
type RSVPStatus = "going" | "waitlisted" | "cancelled";
```

```ts
type Event = {
    id: string
    title: string
    description: string
    location: string
    category: string
    status: EventStatus
    capacity: number | null
    startDatetime: Date
    endDatetime: Date
    organizerId: string
    createdAt: Date
    updatedAt: Date
}
```
```ts
type RSVP = {
    id: string
    eventId: string
    userId: string
    status: RSVPStatus
    createdAt: Date
}
```

```ts
type RSVPWithEvent = {
    id: string
    eventId: string
    userId: string
    status: RSVPStatus
    createdAt: Date
    event: Event
}
```

```ts
type RSVPAttendee = {
    id: string
    eventId: string
    userId: string
    displayName: string
    status: RSVPStatus
    createdAt: Date
}
```
---

## EventService

### `getEventById`

**Used by:** Features 2, 3, 4, 5, 8, 10, 12

```ts
EventService.getEventById(
  eventId: string,
  actingUserId: string,
  actingUserRole: UserRole
): Result<Event, EventNotFoundError | NotAuthorizedError>
```

**Success — `{ ok: true, value: Event }`**

Returns the full `Event` object

**Visibility Rules by Role:**

|   Role  |                              Can Fetch                                 |
|---------|------------------------------------------------------------------------|
|  `user` |                         "published" events only                        |
| `staff` | "published" events and their own drafts (`organizerid === actingUserId`) |
| `admin` |                             all statuses                               |

**Errors:**

|     Error class      |                        When                        |
|----------------------|----------------------------------------------------|
| `EventNotFoundError` |          No event exists with the given ID         |
| `NotAuthorizedError` |  actingUserRole doesn't have visibility of event   |


---
### `createEvent`

**Used by:** Feature 1, 3

```ts
EventService.createEvent(
    actingUserId: string,
    actingUserRole: UserRole,
    data: {
        title: string
        description: string
        location: string
        category: string // thoughts on making category a union of values (like birthday, wedding, graduation) to make searching feasible
        capacity: number | null
        startDatetime: Date
        endDatetime: Date
    }
): Result<Event, InvalidInputError | NotAuthorizedError>
```

**Success — `{ ok: true, value: Event }`**

Returns the full `Event` object as defined in `getEventById` above. Status is always `"draft"` on creation.

**Errors:**

|     Error class     |                                                 When                                                 |
|---------------------|------------------------------------------------------------------------------------------------------|
| `InvalidInputError` |  Any required field is missing, endDatetime is not after startDatetime, or other validation failure  |
| `NotAuthorizedError`|        `actingUserRole` === `"user"`; only `"admin"` and `"staff"` can create event drafts           |

---

### `updateEvent`

**Used by:** Feature 3 

```ts
EventService.updateEvent(
  eventId: string,
  actingUserId: string,
  actingUserRole: UserRole,
  data: Partial<{
    title: string
    description: string
    location: string
    category: string
    capacity: number | null
    startDatetime: Date
    endDatetime: Date
  }>
): Result<Event, EventNotFoundError | NotAuthorizedError | InvalidEventStateError | InvalidInputError>
```

**Success — `{ ok: true, value: Event }`**

Returns the full updated `Event` object.

**Errors:**

|        Error class       |                                     When                                      |
|--------------------------|-------------------------------------------------------------------------------|
|   `EventNotFoundError`   |                        No event exists with the given ID                      |
|   `NotAuthorizedError`   |      Acting user is not authorized to update (not `staff` or an `admin`)      |
| `InvalidEventStateError` |                 Event is in `"cancelled"` or `"past"` status                  |
|   `InvalidInputError`    | Updated field values fail validation (e.g., endDatetime before startDatetime) |

---

### `updateEventStatus`

**Used by:** Features 5, 8

```ts
EventService.updateEventStatus(
  eventId: string,
  actingUserId: string,
  actingUserRole: UserRole,
  newStatus: "published" | "cancelled"
): Result<Event, EventNotFoundError | NotAuthorizedError | InvalidEventStateError>
```

**Success — `{ ok: true, value: Event }`**

Returns the full updated `Event` object with the new status applied.

**Valid transitions:**

|      From     |       To      |
|---------------|---------------|
|   `"draft"`   | `"published"` |
| `"published"` | `"cancelled"` |

All other transitions are rejected.

**Errors:**

|        Error class       |                                   When                                       |
|--------------------------|------------------------------------------------------------------------------|
|    `EventNotFoundError`  |                       No event exists with the given ID                      |
|   `NotAuthorizedError`   | publishing requires `admin` role; deleting requires either `admin` or `staff`|
| `InvalidEventStateError` |       Requested transition is not valid from the event's current status      |

---

### `listEvents`

**Used by:** Features 6, 10

```ts
EventService.listEvents(filters?: {
  category?: string
  timeframe?: "all" | "this_week" | "this_month" | "this_year" 
  //More challenging but we could also change timeframe to accept startdate & enddate and make a calender UI
  searchQuery?: string
}): Result<Event[], InvalidInputError | InvalidSearchQueryError>
```

**Success — `{ ok: true, value: Event[] }`**

Returns an array of `Event` objects. Only `"published"` events with a `startDatetime` in the future are returned. An empty array is a valid success result (not an error). If `filters` is omitted or all filter fields are undefined, all published upcoming events are returned.

**Errors:**

|      Error class    |                             When                              |
|---------------------|---------------------------------------------------------------|
| `InvalidInputError` | `category` or `timeframe` is a value outside the accepted set |
| `InvalidSearchQueryError` | `searchQuery` exceeds allowed length |

---

### `getEventsByOrganizer`

**Used by:** Feature 8

```ts
EventService.getEventsByOrganizer(
  actingUserId: string,
  actingUserRole: UserRole
): Result<Event[], never>
```

**Success — `{ ok: true, value: Event[] }`**

If `actingUserRole === "admin"`, returns all events across all admin. Otherwise returns only events where `organizerId === actingUserId`. Always succeeds (empty array if none found). Sorted by `createdAt` descending.

**Errors:** None.

---

## RSVPService

### `getRSVPsByEvent`

**Used by:** Feature 12

```ts
RSVPService.getRSVPsByEvent(
  eventId: string,
  actingUserId: string,
  actingUserRole: UserRole
): Result<{
  going: RSVPAttendee[]
  waitlisted: RSVPAttendee[]
  cancelled: RSVPAttendee[]
}, EventNotFoundError | NotAuthorizedError>
```

**Success — `{ ok: true, value: { going, waitlisted, cancelled } }`**

Returns all attendees for the event grouped by RSVP status.  
Each attendee row includes:

- `id`, `eventId`, `userId`, `status`, `createdAt`
- `displayName`

Within each group (`going`, `waitlisted`, `cancelled`), rows are sorted by `createdAt` ascending. Empty groups are valid.

**Visibility Rules by Role:**

|   Role  |                               Can View                                 |
|---------|------------------------------------------------------------------------|
|  `user` |                                 Never                                  |
| `staff` |         Only their own events (organizerId === actingUserId)           |
| `admin` |                               all events                               |

**Errors:**

|      Error class.    |                                       When                                     |
|----------------------|--------------------------------------------------------------------------------|
| `EventNotFoundError` |                       No event exists with the given ID                        |
| `NotAuthorizedError` |  Trying to access Attendee list when `actingUserRole` === "user" OR "staff"    |

---

### `getRSVPsByUser`

**Used by:** Features 7

```ts
RSVPService.getRSVPsByUser(userId: string): Result<RSVPWithEvent[], never>
```

**Success — `{ ok: true, value: RSVPWithEvent[] }`**

Returns all RSVPs for the given user across all events, in all statuses. Sorted by `createdAt` descending. Returns an empty array if none exist. Always succeeds.

**Errors:** None.

---

### `toggleRSVP`

**Used by:** Feature 4, 7 

```ts
RSVPService.toggleRSVP(
  eventId: string,
  actingUserId: string,
  actingUserRole: UserRole
): Result<RSVP, EventNotFoundError | InvalidRSVPError>
```

**Success — `{ ok: true, value: RSVP }`**

Returns the resulting RSVP record after the toggle. The three cases:

|       Action       |                   Prior state                  |  Result status |
|--------------------|------------------------------------------------|----------------|
|    "RSVP going"    |        No existing RSVP, event not full        |   `"going"`    |
|    "RSVP going"    |       No existing RSVP, event at capacity      | `"waitlisted"` |
|  "RSVP Cancelled"  |  Existing `"going"` or `"waitlisted"` RSVP     |  `"cancelled"` |
|    "RSVP going"    |   Existing `"cancelled"` RSVP, event not full  |   `"going"`    |
|    "RSVP going"    | Existing `"cancelled"` RSVP, event at capacity | `"waitlisted"` |

**Errors:**

|      Error class     |                                    When                                     |
|----------------------|-----------------------------------------------------------------------------|
| `EventNotFoundError` |                    No event exists with the given ID                        |
|  `InvalidRSVPError`  |       Event is `"cancelled"` or `"past"`, or acting `staff`or `admin`       |

---

### `getAttendeeCount`

**Used by:** Features 2, 8

```ts
RSVPService.getAttendeeCount(eventId: string): Result<number, EventNotFoundError>
```

**Success — `{ ok: true, value: number }`**

Returns the count of RSVPs with `status === "going"` for the given event. Returns `0` if there are none.

**Errors:**

|      Error class     |                When               |
|----------------------|-----------------------------------|
| `EventNotFoundError` | No event exists with the given ID |

---

## Shared Error Classes

```ts
type EventError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "NotAuthorizedError"; message: string }
  | { name: "InvalidEventStateError"; message: string }
  | { name: "InvalidInputError"; message: string }
  | { name: "InvalidRSVPError"; message: string };
```

These are defined once in a shared `/events/errors.ts` file and imported by all service and controller files that need them.

---

## Notes

- Services never read from `req.session` directly. Controllers extract `userId` and `role` from the session and pass them as parameters.
- The `Event` and `RSVP` shapes above define the in-memory data structure for Sprints 1–2. The Prisma schema in Sprint 3 must match these field names so only the repository layer changes.
- `capacity: null` means the event has no limit. Capacity enforcement in `toggleRSVP` compares the current `going` count from `getAttendeeCount` against the event's `capacity` field.
