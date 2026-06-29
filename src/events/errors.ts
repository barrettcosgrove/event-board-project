export type EventError = 
    | { name: "EventNotFoundError"; message: string }
    | { name: "NotAuthorizedError"; message: string }
    | { name: "InvalidEventStateError"; message: string }
    | { name: "InvalidInputError"; message: string }
    | { name: "InvalidSearchQueryError"; message: string }
    | { name: "InvalidRSVPError"; message: string }
    | { name: "UnexpectedDependencyError"; message: string };

export type EventNotFoundError = Extract<EventError, { name: "EventNotFoundError" }>;
export type NotAuthorizedError = Extract<EventError, { name: "NotAuthorizedError" }>;
export type InvalidEventStateError = Extract<EventError, { name: "InvalidEventStateError" }>;
export type InvalidInputError = Extract<EventError, { name: "InvalidInputError" }>;
export type InvalidSearchQueryError = Extract<EventError, { name: "InvalidSearchQueryError" }>;
export type InvalidRSVPError = Extract<EventError, { name: "InvalidRSVPError" }>;
export type UnexpectedDependencyError = Extract<EventError, { name: "UnexpectedDependencyError" }>;

export const EventNotFoundError = (message: string): EventNotFoundError => ({
    name: "EventNotFoundError",
    message,
});

export const NotAuthorizedError = (message: string): NotAuthorizedError => ({
    name: "NotAuthorizedError",
    message,
});

export const InvalidEventStateError = (message: string): InvalidEventStateError => ({
    name: "InvalidEventStateError",
    message,
});

export const InvalidInputError = (message: string): InvalidInputError => ({
    name: "InvalidInputError",
    message,
});

export const InvalidSearchQueryError = (message: string): InvalidSearchQueryError => ({
    name: "InvalidSearchQueryError",
    message,
});

export const InvalidRSVPError = (message: string): InvalidRSVPError => ({
    name: "InvalidRSVPError",
    message,
});

export const UnexpectedDependencyError = (message: string): UnexpectedDependencyError => ({
    name: "UnexpectedDependencyError",
    message,
});
