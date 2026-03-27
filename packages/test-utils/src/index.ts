import type { BoundaryDescriptor } from "@runroot/config";

export function findDuplicateBoundaryNames(
  boundaries: readonly BoundaryDescriptor[],
): string[] {
  const counts = new Map<string, number>();

  for (const boundary of boundaries) {
    const currentCount = counts.get(boundary.name) ?? 0;
    counts.set(boundary.name, currentCount + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
}
