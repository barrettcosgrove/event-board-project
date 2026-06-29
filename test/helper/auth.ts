import request from "supertest";
import { Ok } from "../../src/lib/result";
import type { Result } from "../../src/lib/result";
import type { Express } from "express";
import type { IEventRepository } from "../../src/events/EventRepository";
import type { IRSVPRepository } from "../../src/rsvp/RsvpRepository";
import type { RSVPError } from "../../src/rsvp/errors";
import type { Event as AppEvent } from "../../src/events/Event";
import { ILoggingService } from "../../src/service/LoggingService";

export async function loginAs(app: Express, email: string, password: string) {
  const agent = request.agent(app);

  await agent
    .post("/login")
    .type("form")
    .send({ email, password });

  return agent;
}

export const makeEvent = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  id: "event-1",
  title: "Spring Picnic",
  description: "Food, games, and fun on the lawn.",
  location: "Campus Pond Lawn",
  category: "party",
  status: "published",
  capacity: 25,
  startDatetime: new Date("2030-04-20T15:00:00.000Z"),
  endDatetime: new Date("2030-04-20T17:00:00.000Z"),
  organizerId: "user-staff",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export function makeEventRepo(
  eventResult: Result<AppEvent | null, any> = Ok(makeEvent()),
): jest.Mocked<IEventRepository> {
  return {
    findById: jest.fn().mockResolvedValue(eventResult),
    findByOrganizer: jest.fn().mockResolvedValue(Ok([])),
    findAll: jest.fn().mockResolvedValue(Ok([])),
    findPublishedUpcoming: jest.fn().mockResolvedValue(Ok([])),
    create: jest.fn().mockImplementation(async (event) => Ok(event)),
    update: jest.fn().mockImplementation(async (event) => Ok(event)),
    updateStatus: jest.fn().mockImplementation(async () => Ok(undefined)),
  };
}

export function makeRsvpRepo(
  countResult: Result<number, RSVPError> = Ok(3),
): jest.Mocked<IRSVPRepository> {
  return {
    findByUser: jest.fn().mockResolvedValue(Ok([])),
    findByEventId: jest.fn().mockResolvedValue(Ok([])),
    findAttendeesByEventId: jest.fn().mockResolvedValue(Ok([])),
    findByUserAndEvent: jest.fn().mockResolvedValue(Ok(null)),
    countGoing: jest.fn().mockResolvedValue(countResult),
    save: jest.fn().mockImplementation(async (rsvp) => Ok(rsvp)),
    findOverlappingActiveRsvps: jest.fn().mockResolvedValue(Ok([])),
  };
}

export function makeLogger(): jest.Mocked<ILoggingService> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}