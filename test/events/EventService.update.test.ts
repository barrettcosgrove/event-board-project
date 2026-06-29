import { CreateEventService } from "../../src/events/EventService";
import { CreateInMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import { CreateInMemoryRsvpRepository } from "../../src/rsvp/InMemoryRsvpRepository";

function makeService() {
    return CreateEventService(
        CreateInMemoryEventRepository(),
        CreateInMemoryRsvpRepository(),
    );
}

const validUpdate = {
    title: "Updated Title",
    description: "Updated description.",
    location: "Updated Location",
    category: "networking",
    capacity: null,
    startDatetime: new Date("2027-06-01T10:00:00"),
    endDatetime: new Date("2027-06-01T12:00:00"),
};

describe("EventService.updateEvent", () => {

    // Happy paths

    it("allows staff to update their own draft event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            validUpdate,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.title).toBe("Updated Title");
        }
    });

    it("allows admin to update any event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-admin",
            "admin",
            { title: "Admin Updated Title" },
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.title).toBe("Admin Updated Title");
        }
    });

    it("allows partial updates — only provided fields change", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { title: "Just the title changed" },
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.title).toBe("Just the title changed");
            expect(result.value.location).toBe("Student Union 201");
        }
    });

    // EventNotFoundError

    it("rejects when event does not exist", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-does-not-exist",
            "user-staff",
            "staff",
            validUpdate,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("EventNotFoundError");
        }
    });

    // NotAuthorizedError

    it("rejects when staff tries to edit another organizer's event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-other-staff",
            "staff",
            validUpdate,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("NotAuthorizedError");
        }
    });

    it("rejects when user role tries to edit an event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-reader",
            "user",
            validUpdate,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("NotAuthorizedError");
        }
    });

    // InvalidEventStateError

    it("rejects editing a cancelled event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-cancelled-1",
            "user-staff",
            "staff",
            validUpdate,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidEventStateError");
        }
    });

    it("rejects editing a past event", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-past-1",
            "user-admin",
            "admin",
            validUpdate,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidEventStateError");
        }
    });

    // InvalidInputError

    it("rejects when title is set to empty string", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { title: "" },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Title is required.");
        }
    });

    it("rejects when description is set to empty string", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { description: "" },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Description is required.");
        }
    });

    it("rejects when location is set to empty string", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { location: "" },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Location is required.");
        }
    });

    it("rejects when category is set to empty string", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { category: "" },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Category is required.");
        }
    });

    it("rejects when endDatetime is before startDatetime", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            {
                startDatetime: new Date("2027-06-01T12:00:00"),
                endDatetime: new Date("2027-06-01T10:00:00"),
            },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("End date and time must be after start date and time.");
        }
    });

    it("rejects when capacity is zero", async () => {
        const service = makeService();
        const result = await service.updateEvent(
            "event-draft-1",
            "user-staff",
            "staff",
            { capacity: 0 },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.value.name).toBe("InvalidInputError");
            expect(result.value.message).toBe("Capacity must be a positive whole number.");
        }
    });
});