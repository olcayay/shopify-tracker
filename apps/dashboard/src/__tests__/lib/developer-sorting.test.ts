import { describe, it, expect } from "vitest";

/**
 * Tests for developer sorting logic used on /developers and /[platform]/developers.
 * The sortDevelopers function is defined inline in page components, so we test the
 * same algorithm here to prevent regression.
 */

interface MockDev {
  name: string;
  appCount: number;
  platformCount: number;
  isStarred: boolean;
}

function sortDevelopers(
  devs: MockDev[],
  sort: string,
  order: "asc" | "desc"
): MockDev[] {
  return [...devs].sort((a, b) => {
    // Starred always first
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    // Then by current sort field
    let cmp = 0;
    if (sort === "apps") {
      cmp = a.appCount - b.appCount;
    } else if (sort === "platforms") {
      cmp = a.platformCount - b.platformCount;
    } else {
      cmp = a.name.localeCompare(b.name);
    }
    return order === "desc" ? -cmp : cmp;
  });
}

const devs: MockDev[] = [
  { name: "Charlie", appCount: 5, platformCount: 2, isStarred: false },
  { name: "Alice", appCount: 10, platformCount: 3, isStarred: true },
  { name: "Bob", appCount: 3, platformCount: 1, isStarred: true },
  { name: "Dave", appCount: 8, platformCount: 4, isStarred: false },
];

describe("Developer sorting", () => {
  it("sorts by name ascending with starred first", () => {
    const result = sortDevelopers(devs, "name", "asc");
    expect(result.map((d) => d.name)).toEqual(["Alice", "Bob", "Charlie", "Dave"]);
  });

  it("sorts by name descending with starred first", () => {
    const result = sortDevelopers(devs, "name", "desc");
    expect(result.map((d) => d.name)).toEqual(["Bob", "Alice", "Dave", "Charlie"]);
  });

  it("sorts by apps ascending with starred first", () => {
    const result = sortDevelopers(devs, "apps", "asc");
    expect(result.map((d) => d.name)).toEqual(["Bob", "Alice", "Charlie", "Dave"]);
  });

  it("sorts by apps descending with starred first", () => {
    const result = sortDevelopers(devs, "apps", "desc");
    expect(result.map((d) => d.name)).toEqual(["Alice", "Bob", "Dave", "Charlie"]);
  });

  it("sorts by platforms ascending with starred first", () => {
    const result = sortDevelopers(devs, "platforms", "asc");
    // Starred: Bob(1) < Alice(3) → Bob first
    // Non-starred: Charlie(2) < Dave(4) → Charlie first
    expect(result.map((d) => d.name)).toEqual(["Bob", "Alice", "Charlie", "Dave"]);
  });

  it("sorts starred developers among themselves by the active sort field", () => {
    const result = sortDevelopers(devs, "apps", "asc");
    // Starred: Bob(3), Alice(10) → Bob first (3 < 10)
    expect(result[0].name).toBe("Bob");
    expect(result[1].name).toBe("Alice");
    // Non-starred: Charlie(5), Dave(8) → Charlie first (5 < 8)
    expect(result[2].name).toBe("Charlie");
    expect(result[3].name).toBe("Dave");
  });

  it("non-starred developers are sorted among themselves", () => {
    const result = sortDevelopers(devs, "apps", "desc");
    // Starred: Alice(10), Bob(3) → Alice first (desc: higher first)
    expect(result[0].name).toBe("Alice");
    expect(result[1].name).toBe("Bob");
    // Non-starred: Dave(8), Charlie(5) → Dave first (desc: higher first)
    expect(result[2].name).toBe("Dave");
    expect(result[3].name).toBe("Charlie");
  });

  it("handles all developers being starred", () => {
    const allStarred = devs.map((d) => ({ ...d, isStarred: true }));
    const result = sortDevelopers(allStarred, "name", "asc");
    expect(result.map((d) => d.name)).toEqual(["Alice", "Bob", "Charlie", "Dave"]);
  });

  it("handles no developers being starred", () => {
    const noneStarred = devs.map((d) => ({ ...d, isStarred: false }));
    const result = sortDevelopers(noneStarred, "apps", "desc");
    expect(result.map((d) => d.name)).toEqual(["Alice", "Dave", "Charlie", "Bob"]);
  });

  it("handles empty array", () => {
    expect(sortDevelopers([], "name", "asc")).toEqual([]);
  });
});
