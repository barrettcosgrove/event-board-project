import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaEventRepository } from "../../src/events/PrismaEventRepository";
import { CreateEventService } from "../../src/events/EventService";
import { CreateInMemoryRsvpRepository } from "../../src/rsvp/InMemoryRsvpRepository";
import { seedTestDatabase } from "../helper/seed";

describe("Feature 10 Sprint 3 - Event Search service (Prisma)", () => {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
  });
  const prisma = new PrismaClient({ adapter });
  const eventRepository = new PrismaEventRepository(prisma);
  const rsvpRepository = CreateInMemoryRsvpRepository();
  const service = CreateEventService(eventRepository, rsvpRepository);

  beforeEach(async () => {
    await seedTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns published upcoming Prisma events that match search query", async () => {
    const result = await service.listEvents("user-1", "user", { searchQuery: "graduation" });

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value.some((event) => event.title === "Graduation Celebration")).toBe(true);
      expect(result.value.every((event) => event.status === "published")).toBe(true);
    }
  });

  it("returns InvalidSearchQueryError for queries longer than 100 characters", async () => {
    const result = await service.listEvents("user-1", "user", {
      searchQuery: "x".repeat(101),
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.value.name).toBe("InvalidSearchQueryError");
    }
  });

  it("does not return draft events to regular users even when query matches draft title", async () => {
    const result = await service.listEvents("user-1", "user", { searchQuery: "draft planning" });

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value.some((event) => event.title === "Draft Planning Meeting")).toBe(false);
    }
  });
});
