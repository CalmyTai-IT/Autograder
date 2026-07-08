import type { ComplexityTier, Rubric } from "@/types";

export const DEFAULT_COMPLEXITY_TIERS: ComplexityTier[] = [
  { label: "O(n)", maxPercent: 100 },
  { label: "O(n log n)", maxPercent: 90 },
  { label: "O(n²)", maxPercent: 60 },
  { label: "O(n³)", maxPercent: 30 },
  { label: "Chậm hơn", maxPercent: 0 },
];

export function defaultRubric(): Rubric {
  return {
    testcaseWeight: 80,
    complexityEnabled: true,
    complexityWeight: 20,
    complexityTiers: DEFAULT_COMPLEXITY_TIERS.map((t) => ({ ...t })),
    plagiarismEnabled: true,
    plagiarismThreshold: 85,
  };
}

/** Mô tả ngắn gọn rubric để hiển thị nhanh */
export function rubricSummary(r: Rubric): string {
  const parts = [`Testcase ${r.testcaseWeight}%`];
  if (r.complexityEnabled) parts.push(`Độ phức tạp ${r.complexityWeight}%`);
  if (r.plagiarismEnabled) parts.push(`Chống gian lận ≥ ${r.plagiarismThreshold}%`);
  return parts.join(" · ");
}
