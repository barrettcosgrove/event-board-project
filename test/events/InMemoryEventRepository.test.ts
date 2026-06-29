import { CreateInMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import type { Event } from "../../src/events/Event";

describe("InMemoryEventRepository", () => {
  function makeEvent(overrides: Partial<Event>): Event {
    return {
      id: "event-test",
      title: "Test Event",
      description: "desc",
      location: "Amherst",
      category: "party",
      status: "published",
      capacity: null,
      startDatetime: new Date("2030-04-20T12:00:00.000Z"),
      endDatetime: new Date("2030-04-20T13:00:00.000Z"),
      organizerId: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("returns only published upcoming events", async () => {
    const repo = CreateInMemoryEventRepository();

    await repo.create(
      makeEvent({
        id: "event-1",
        title: "Published Upcoming",
        status: "published",
        startDatetime: new Date("2030-04-20T12:00:00.000Z"),
        endDatetime: new Date("2030-04-20T13:00:00.000Z"),
      }),
    );

    await repo.create(
      makeEvent({
        id: "event-2",
        title: "Draft Upcoming",
        status: "draft",
        startDatetime: new Date("2030-04-21T12:00:00.000Z"),
        endDatetime: new Date("2030-04-21T13:00:00.000Z"),
      }),
    );

    await repo.create(
      makeEvent({
        id: "event-3",
        title: "Published Past",
        status: "published",
        startDatetime: new Date("2020-04-10T12:00:00.000Z"),
        endDatetime: new Date("2020-04-10T13:00:00.000Z"),
      }),
    );

    const result = await repo.findPublishedUpcoming();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.map((event) => event.id);

    expect(ids).toContain("event-1");
    expect(ids).not.toContain("event-2");
    expect(ids).not.toContain("event-3");
  });

  it("filters published upcoming events by category", async () => {
    const repo = CreateInMemoryEventRepository();

    await repo.create(
      makeEvent({
        id: "event-party",
        category: "party",
        startDatetime: new Date("2030-04-20T12:00:00.000Z"),
        endDatetime: new Date("2030-04-20T13:00:00.000Z"),
      }),
    );

    await repo.create(
      makeEvent({
        id: "event-business",
        category: "business",
        startDatetime: new Date("2030-04-21T12:00:00.000Z"),
        endDatetime: new Date("2030-04-21T13:00:00.000Z"),
      }),
    );

    const result = await repo.findPublishedUpcoming({ category: "party" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.every((event) => event.category === "party")).toBe(true);
    expect(result.value.some((event) => event.id === "event-party")).toBe(true);
    expect(result.value.some((event) => event.id === "event-business")).toBe(false);
  });

  it("filters published upcoming events by timeframe", async () => {
    const repo = CreateInMemoryEventRepository();

    const now = new Date();

    await repo.create(
      makeEvent({
        id: "event-soon",
        startDatetime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        endDatetime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      }),
    );

    await repo.create(
      makeEvent({
        id: "event-later",
        startDatetime: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
        endDatetime: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      }),
    );

    const result = await repo.findPublishedUpcoming({ timeframe: "this_week" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.map((event) => event.id);

    expect(ids).toContain("event-soon");
    expect(ids).not.toContain("event-later");
  });

  it("returns an empty array when no published upcoming events match", async () => {
    const repo = CreateInMemoryEventRepository();

    await repo.create(
      makeEvent({
        id: "draft-only",
        status: "draft",
        startDatetime: new Date("2030-04-20T12:00:00.000Z"),
        endDatetime: new Date("2030-04-20T13:00:00.000Z"),
      }),
    );

    const result = await repo.findPublishedUpcoming({ category: "technology" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toEqual([]);
  });
});