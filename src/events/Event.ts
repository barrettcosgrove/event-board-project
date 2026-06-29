export type EventStatus = "draft" | "published" | "cancelled" | "past";

export const VALID_CATEGORIES = [
    "technology",
    "business",
    "music",
    "art",
    "food",
    "health",
    "education",
    "sports",
    "gaming",
    "networking",
    "party",
    "holiday",
    "birthday",
    "graduation",
    "wedding",
    "movies and tv",
    "other"] as const;

export type EventCategory = (typeof VALID_CATEGORIES)[number];

export const VALID_TIMEFRAMES = ["all", "this_week", "this_month", "this_year"] as const;

export type EventTimeframe = (typeof VALID_TIMEFRAMES)[number];

export function isEventCategory(value: string): value is EventCategory {
    return (VALID_CATEGORIES as readonly string[]).includes(value);
}

export function isEventTimeframe(value: string): value is EventTimeframe {
    return (VALID_TIMEFRAMES as readonly string[]).includes(value);
}

export interface Event {
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
    conflictWarning?: string | null
}

export interface CreateEventData {
    title: string;
    description: string;
    location: string;
    category: string;
    capacity: number | null;
    startDatetime: Date;
    endDatetime: Date;
    organizerId: string;
}

export interface EventFilters {
    category?: EventCategory;
    timeframe?: EventTimeframe;
    searchQuery?: string;
}

export type EventDetailView = {
    event: Event;
    attendeeCount: number;
};

export interface OrganizerDashboard {
    published: EventDetailView[];
    draft: EventDetailView[];
    cancelledOrPast: EventDetailView[];
}
