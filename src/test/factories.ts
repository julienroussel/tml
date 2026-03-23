import type {
  Goal,
  Item,
  NewGoal,
  NewItem,
  NewPerformance,
  NewPracticeSession,
  NewTrick,
  NewUser,
  Performance,
  PracticeSession,
  Routine,
  Trick,
  User,
} from "@/db/types";

/** Test data factories. Import these in tests to create entities with sensible defaults. */
let counter = 0;

function nextId(): string {
  counter++;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, "0")}`;
}

function createTestUser(overrides?: Partial<NewUser>): User {
  return {
    id: nextId(),
    email: `user-${counter}@test.com`,
    displayName: `Test User ${counter}`,
    role: "user",
    locale: "en",
    theme: "system",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestTrick(overrides?: Partial<NewTrick>): Trick {
  return {
    id: nextId(),
    userId: nextId(),
    name: `Test Trick ${counter}`,
    description: "A test trick",
    category: "card",
    difficulty: 3,
    status: "new",
    tags: ["test"],
    notes: null,
    source: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestRoutine(overrides?: Partial<Routine>): Routine {
  return {
    id: nextId(),
    userId: nextId(),
    name: `Test Routine ${counter}`,
    description: "A test routine",
    estimatedDurationMinutes: 15,
    tags: null,
    language: null,
    environment: null,
    requirements: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestPracticeSession(
  overrides?: Partial<NewPracticeSession>
): PracticeSession {
  return {
    id: nextId(),
    userId: nextId(),
    date: new Date().toISOString().slice(0, 10),
    durationMinutes: 30,
    mood: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestPerformance(
  overrides?: Partial<NewPerformance>
): Performance {
  return {
    id: nextId(),
    userId: nextId(),
    date: new Date().toISOString().slice(0, 10),
    venue: "Test Venue",
    eventName: "Test Event",
    routineId: null,
    audienceSize: 50,
    audienceType: null,
    durationMinutes: null,
    rating: 4,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestItem(overrides?: Partial<NewItem>): Item {
  return {
    id: nextId(),
    userId: nextId(),
    name: `Test Item ${counter}`,
    type: "prop",
    description: null,
    brand: null,
    condition: "good",
    location: null,
    notes: null,
    purchaseDate: null,
    purchasePrice: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestGoal(overrides?: Partial<NewGoal>): Goal {
  return {
    id: nextId(),
    userId: nextId(),
    title: `Test Goal ${counter}`,
    description: "A test goal",
    targetType: "practice_streak",
    targetValue: 7,
    currentValue: 0,
    deadline: null,
    completedAt: null,
    trickId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export {
  createTestGoal,
  createTestItem,
  createTestPerformance,
  createTestPracticeSession,
  createTestRoutine,
  createTestTrick,
  createTestUser,
};
