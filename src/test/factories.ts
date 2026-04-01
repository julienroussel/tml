import type {
  Goal,
  Item,
  NewGoal,
  NewItem,
  NewPerformance,
  NewPracticeSession,
  NewTag,
  NewTrick,
  NewUser,
  Performance,
  PracticeSession,
  Setlist,
  Tag,
  Trick,
  TrickTag,
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
    bannedAt: null,
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
    effectType: null,
    difficulty: 3,
    status: "new",
    duration: null,
    performanceType: null,
    angleSensitivity: null,
    props: null,
    music: null,
    languages: null,
    isCameraFriendly: null,
    isSilent: null,
    notes: null,
    source: null,
    videoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestTag(overrides?: Partial<NewTag>): Tag {
  return {
    id: nextId(),
    userId: nextId(),
    name: `test-tag-${counter}`,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestTrickTag(overrides?: Partial<TrickTag>): TrickTag {
  return {
    id: nextId(),
    userId: nextId(),
    trickId: nextId(),
    tagId: nextId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function createTestSetlist(overrides?: Partial<Setlist>): Setlist {
  return {
    id: nextId(),
    userId: nextId(),
    name: `Test Setlist ${counter}`,
    description: "A test setlist",
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
    setlistId: null,
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
  createTestSetlist,
  createTestTag,
  createTestTrick,
  createTestTrickTag,
  createTestUser,
};
