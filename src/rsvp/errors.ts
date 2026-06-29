export type RSVPError =
    | { name: "EventNotFoundError"; message: string }
    | { name: "NotAuthorizedError"; message: string }
    | { name: "InvalidRSVPError"; message: string }
    | { name: "UnexpectedDependencyError"; message: string };

export type EventNotFoundError = Extract<RSVPError, { name: "EventNotFoundError" }>;
export type NotAuthorizedError = Extract<RSVPError, { name: "NotAuthorizedError" }>;
export type InvalidRSVPError = Extract<RSVPError, { name: "InvalidRSVPError" }>;
export type UnexpectedDependencyError = Extract<RSVPError, { name: "UnexpectedDependencyError" }>;

export const EventNotFoundError = (message: string): EventNotFoundError => ({
    name: "EventNotFoundError",
    message,
});

export const NotAuthorizedError = (message: string): NotAuthorizedError => ({
    name: "NotAuthorizedError",
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
