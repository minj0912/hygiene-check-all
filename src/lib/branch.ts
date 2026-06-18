import { Restroom } from "@/types";

export type BranchId = "apgujeong" | "cheonho";

export interface BranchInfo {
  id: BranchId;
  name: string;
  initialPassword: string;
  defaultRestrooms: Restroom[];
}

export const BRANCHES: Record<BranchId, BranchInfo> = {
  apgujeong: {
    id: "apgujeong",
    name: "본점",
    initialPassword: "0001",
    defaultRestrooms: [
      { id: "b2_women_1", floor: "B2층", name: "B2층 여자화장실", locationLabel: "", order: 1 },
      { id: "b2_men_1", floor: "B2층", name: "B2층 남자화장실", locationLabel: "", order: 2 },
      { id: "b2_women_2", floor: "B2층", name: "B2층 여자화장실2", locationLabel: "", order: 3 },
      { id: "b1_women_1", floor: "B1층", name: "B1층 여자화장실", locationLabel: "", order: 4 },
      { id: "b1_men_1", floor: "B1층", name: "B1층 남자화장실", locationLabel: "", order: 5 },
      { id: "b1_accessible_1", floor: "B1층", name: "B1층 장애인화장실", locationLabel: "", order: 6 },
    ],
  },
  cheonho: {
    id: "cheonho",
    name: "천호점",
    initialPassword: "0003",
    defaultRestrooms: [
      { id: "b1_men_1", floor: "B1층", name: "B1층 남자화장실", locationLabel: "", order: 1 },
      { id: "b1_women_1", floor: "B1층", name: "B1층 여자화장실", locationLabel: "", order: 2 },
      { id: "2f_men_1", floor: "2층", name: "2층 남자화장실", locationLabel: "", order: 3 },
      { id: "2f_women_1", floor: "2층", name: "2층 여자화장실", locationLabel: "", order: 4 },
    ],
  },
};

export function getBranchIdFromUrl(): BranchId | null {
  const params = new URLSearchParams(window.location.search);
  const branch = params.get("branch")?.toLowerCase();
  if (branch === "apgujeong" || branch === "cheonho") return branch;
  return null;
}

export function getCurrentBranchInfo(): BranchInfo | null {
  const branchId = getBranchIdFromUrl();
  return branchId ? BRANCHES[branchId] : null;
}

export function getCurrentBranchName(): string {
  return getCurrentBranchInfo()?.name ?? "무역센터점";
}

export function makeRestroomUrl(restroomId: string): string {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const branchId = getBranchIdFromUrl();
  const params = new URLSearchParams();

  if (branchId) params.set("branch", branchId);
  params.set("restroom", restroomId);

  return `${baseUrl}?${params.toString()}`;
}

export function makeModeUrl(mode: "admin" | "inspector"): string {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const branchId = getBranchIdFromUrl();
  const params = new URLSearchParams();

  if (branchId) params.set("branch", branchId);
  params.set("mode", mode);

  return `${baseUrl}?${params.toString()}`;
}

export function getInitialModeFromUrl(): "home" | "inspector" | "admin" {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "inspector" || mode === "admin") return mode;
  return "home";
}

export function getDefaultRestroomsForCurrentBranch(fallback: Restroom[]): Restroom[] {
  return getCurrentBranchInfo()?.defaultRestrooms ?? fallback;
}
