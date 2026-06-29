import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({

  url: "file:./prisma/dev.db",

});

const prisma = new PrismaClient({ adapter });

async function main() {
    await prisma.rSVP.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({
        data: [
        {
            id: "user-reader",
            email: "user@app.test",
            displayName: "Una User",
            role: "user",
            passwordHash: "password123",
        },
        {
            id: "user-staff",
            email: "staff@app.test",
            displayName: "Sam Staff",
            role: "staff",
            passwordHash: "password123",
        },
        {
            id: "user-admin",
            email: "admin@app.test",
            displayName: "Avery Admin",
            role: "admin",
            passwordHash: "password123",
        },
        ],
    });

    const now = new Date();
    const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const oneYearAndTwoHours = new Date(oneYear.getTime() + 2 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAndThreeHours = new Date(thirtyDays.getTime() + 3 * 60 * 60 * 1000);
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAndOneHour = new Date(sevenDays.getTime() + 60 * 60 * 1000);

    await prisma.event.createMany({
        data: [
            {
                id: "event-published-1",
                title: "Spring Picnic",
                description: "Food, games, and fun on the lawn.",
                location: "Campus Pond Lawn",
                category: "party",
                status: "published",
                capacity: 25,
                startDatetime: oneYear,
                endDatetime: oneYearAndTwoHours,
                organizerId: "user-staff",
            },
            {
                id: "event-published-2",
                title: "Graduation Celebration",
                description: "Come congratulate our Seniors.",
                location: "Boston, MA",
                category: "graduation",
                status: "published",
                capacity: 100,
                startDatetime: thirtyDays,
                endDatetime: thirtyDaysAndThreeHours,
                organizerId: "user-admin",
            },
            {
                id: "event-published-3",
                title: "Startup Networking Night",
                description: "Meet founders and investors.",
                location: "Innovation Hub",
                category: "business",
                status: "published",
                capacity: 40,
                startDatetime: sevenDays,
                endDatetime: sevenDaysAndOneHour,
                organizerId: "user-staff",
            },
            {
                id: "event-draft-1",
                title: "Draft Planning Meeting",
                description: "This is still a draft event.",
                location: "Student Union 201",
                category: "networking",
                status: "draft",
                capacity: 10,
                startDatetime: sevenDays,
                endDatetime: sevenDaysAndOneHour,
                organizerId: "user-staff",
            },
            {
                id: "event-draft-admin",
                title: "Admin Draft Event",
                description: "A draft owned by admin for cross-organizer testing.",
                location: "Admin Office",
                category: "networking",
                status: "draft",
                capacity: 10,
                startDatetime: oneYear,
                endDatetime: oneYearAndTwoHours,
                organizerId: "user-admin",
            },
            {
                id: "event-cancelled-1",
                title: "Cancelled Hackathon",
                description: "This event has been cancelled.",
                location: "Engineering Hall",
                category: "technology",
                status: "cancelled",
                capacity: 50,
                startDatetime: sevenDays,
                endDatetime: sevenDaysAndOneHour,
                organizerId: "user-staff",
            },
            {
                id: "event-past-1",
                title: "Past Music Night",
                description: "An old music event that already happened.",
                location: "Campus Auditorium",
                category: "music",
                status: "published",
                capacity: 75,
                startDatetime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                endDatetime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
                organizerId: "user-admin",
            },
            {
                id: "event-conflict-1",
                title: "Morning Workshop",
                description: "A morning workshop.",
                location: "Room 101",
                category: "education",
                status: "published",
                capacity: 50,
                startDatetime: new Date("2030-06-01T09:00:00.000Z"),
                endDatetime: new Date("2030-06-01T11:00:00.000Z"),
                organizerId: "user-staff",
            },
            {
                id: "event-conflict-2",
                title: "Overlapping Seminar",
                description: "A seminar that overlaps with the morning workshop.",
                location: "Room 202",
                category: "education",
                status: "published",
                capacity: 50,
                startDatetime: new Date("2030-06-01T10:00:00.000Z"),
                endDatetime: new Date("2030-06-01T12:00:00.000Z"),
                organizerId: "user-staff",
            },
            {
                id: "event-long-description-1",
                title: "Storytelling Marathon",
                description: "Join us for an immersive storytelling marathon featuring student performers, alumni guests, and community writers. This event is designed to test long card descriptions in the UI, so the text intentionally goes beyond two hundred characters to trigger the Read more and Show less interaction on the events list.",
                location: "Main Auditorium",
                category: "art",
                status: "published",
                capacity: 120,
                startDatetime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
                endDatetime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
                organizerId: "user-staff",
            },
        ],
    });

    console.log("Database seeded successfully.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
