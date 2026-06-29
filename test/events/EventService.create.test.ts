import { CreateEventService } from "../../src/events/EventService";
import { CreateInMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import { CreateInMemoryRsvpRepository } from "../../src/rsvp/InMemoryRsvpRepository";

const validData = {
    title: "Test Event",
    description: "A test event description.",
    location: "Amherst, MA",
    category: "networking",
    capacity: null,
    startDatetime: new Date("2027-06-01T10:00:00"),
    endDatetime: new Date("2027-06-01T12:00:00"),
};

function makeService() {
    return CreateEventService(
        CreateInMemoryEventRepository(),
        CreateInMemoryRsvpRepository(),
    );
}

describe("EventService.createEvent", () => {

    // Happy paths

    it("creates a draft event for a staff user", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", validData);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.title).toBe("Test Event");
            expect(result.value.status).toBe("draft");
            expect(result.value.organizerId).toBe("user-staff");
        }
    });

    it("creates a draft event for an admin user", async () => {
        const service = makeService();
        const result = await service.createEvent("user-admin", "admin", validData);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.status).toBe("draft");
            expect(result.value.organizerId).toBe("user-admin");
        }
    });

    it("creates an event with a capacity limit", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            capacity: 50,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.capacity).toBe(50);
        }
    });

    // NotAuthorizedError

    it("rejects event creation for a user role", async () => {
        const service = makeService();
        const result = await service.createEvent("user-reader", "user", validData);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("NotAuthorizedError");
        }
    });

    // InvalidInputError — missing required fields

    it("rejects when title is empty", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            title: "",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Title is required.");
        }
    });

    it("rejects when title is only whitespace", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            title: "   ",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("rejects when description is empty", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            description: "",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Description is required.");
        }
    });

    it("rejects when location is empty", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            location: "",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Location is required.");
        }
    });

    it("rejects when category is empty", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            category: "",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Category is required.");
        }
    });

    // InvalidInputError — datetime validation

    it("rejects when startDatetime is invalid", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            startDatetime: new Date("invalid"),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Start date and time is invalid.");
        }
    });

    it("rejects when endDatetime is invalid", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            endDatetime: new Date("invalid"),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("End date and time is invalid.");
        }
    });

    it("rejects when endDatetime is before startDatetime", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            startDatetime: new Date("2027-06-01T12:00:00"),
            endDatetime: new Date("2027-06-01T10:00:00"),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("End date and time must be after start date and time.");
        }
    });

    it("rejects when endDatetime equals startDatetime", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            startDatetime: new Date("2027-06-01T10:00:00"),
            endDatetime: new Date("2027-06-01T10:00:00"),
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    // InvalidInputError — capacity validation

    it("rejects when capacity is zero", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            capacity: 0,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Capacity must be a positive whole number.");
        }
    });

    it("rejects when capacity is a negative number", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            capacity: -5,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
        }
    });

    it("rejects when capacity is a decimal", async () => {
        const service = makeService();
        const result = await service.createEvent("user-staff", "staff", {
            ...validData,
            capacity: 10.5,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
        }
    });
});