import { Restroom } from "@/types";

export type BranchId =
  | "apgujeong"
  | "cheonho"
  | "sinchon"
  | "mia"
  | "mokdong"
  | "jungdong"
  | "kintex"
  | "ulsan"
  | "thehyundai_daegu"
  | "chungcheong"
  | "pangyo"
  | "thehyundai_seoul"
  | "gimpo_outlet"
  | "songdo_outlet"
  | "daejeon_outlet"
  | "space1"
  | "dongdaemun_outlet"
  | "garden5"
  | "daegu_outlet"
  | "gasan_outlet"
  | "connect_busan"
  | "connect_cheongju";

export interface BranchInfo {
  id: BranchId;
  name: string;
  initialPassword: string;
  legacyInitialPassword?: string;
  defaultRestrooms: Restroom[];
}

function defaultB1Restrooms(): Restroom[] {
  return [
    { id: "b1_men_1", floor: "B1층", name: "B1층 남자화장실", locationLabel: "", order: 1 },
    { id: "b1_women_1", floor: "B1층", name: "B1층 여자화장실", locationLabel: "", order: 2 },
  ];
}

export const BRANCHES: Record<BranchId, BranchInfo> = {
  apgujeong: {
    id: "apgujeong",
    name: "압구정 본점",
    initialPassword: "1111",
    legacyInitialPassword: "0001",
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
    initialPassword: "1113",
    legacyInitialPassword: "0003",
    defaultRestrooms: [
      { id: "b1_men_1", floor: "B1층", name: "B1층 남자화장실", locationLabel: "", order: 1 },
      { id: "b1_women_1", floor: "B1층", name: "B1층 여자화장실", locationLabel: "", order: 2 },
      { id: "2f_men_1", floor: "2층", name: "2층 남자화장실", locationLabel: "", order: 3 },
      { id: "2f_women_1", floor: "2층", name: "2층 여자화장실", locationLabel: "", order: 4 },
    ],
  },
  sinchon: { id: "sinchon", name: "신촌점", initialPassword: "1114", defaultRestrooms: defaultB1Restrooms() },
  mia: { id: "mia", name: "미아점", initialPassword: "1115", defaultRestrooms: defaultB1Restrooms() },
  mokdong: { id: "mokdong", name: "목동점", initialPassword: "1116", defaultRestrooms: defaultB1Restrooms() },
  jungdong: { id: "jungdong", name: "중동점", initialPassword: "1117", defaultRestrooms: defaultB1Restrooms() },
  kintex: { id: "kintex", name: "킨텍스점", initialPassword: "1118", defaultRestrooms: defaultB1Restrooms() },
  ulsan: { id: "ulsan", name: "울산점", initialPassword: "1119", defaultRestrooms: defaultB1Restrooms() },
  thehyundai_daegu: { id: "thehyundai_daegu", name: "더현대 대구점", initialPassword: "1120", defaultRestrooms: defaultB1Restrooms() },
  chungcheong: { id: "chungcheong", name: "충청점", initialPassword: "1121", defaultRestrooms: defaultB1Restrooms() },
  pangyo: { id: "pangyo", name: "판교점", initialPassword: "1122", defaultRestrooms: defaultB1Restrooms() },
  thehyundai_seoul: { id: "thehyundai_seoul", name: "더현대서울", initialPassword: "1123", defaultRestrooms: defaultB1Restrooms() },
  gimpo_outlet: { id: "gimpo_outlet", name: "김포아울렛", initialPassword: "1124", defaultRestrooms: defaultB1Restrooms() },
  songdo_outlet: { id: "songdo_outlet", name: "송도아울렛", initialPassword: "1125", defaultRestrooms: defaultB1Restrooms() },
  daejeon_outlet: { id: "daejeon_outlet", name: "대전 아울렛", initialPassword: "1126", defaultRestrooms: defaultB1Restrooms() },
  space1: { id: "space1", name: "SPACE 1", initialPassword: "1127", defaultRestrooms: defaultB1Restrooms() },
  dongdaemun_outlet: { id: "dongdaemun_outlet", name: "동대문 아울렛", initialPassword: "1128", defaultRestrooms: defaultB1Restrooms() },
  garden5: { id: "garden5", name: "가든파이브", initialPassword: "1129", defaultRestrooms: defaultB1Restrooms() },
  daegu_outlet: { id: "daegu_outlet", name: "대구 아울렛", initialPassword: "1130", defaultRestrooms: defaultB1Restrooms() },
  gasan_outlet: { id: "gasan_outlet", name: "가산 아울렛", initialPassword: "1131", defaultRestrooms: defaultB1Restrooms() },
  connect_busan: { id: "connect_busan", name: "커넥트 현대 부산", initialPassword: "1132", defaultRestrooms: defaultB1Restrooms() },
  connect_cheongju: { id: "connect_cheongju", name: "커넥트 현대 청주", initialPassword: "1133", defaultRestrooms: defaultB1Restrooms() },
};

export function getBranchIdFromUrl(): BranchId | null {
  const params = new URLSearchParams(window.location.search);
  const branch = params.get("branch")?.toLowerCase() as BranchId | undefined;
  if (branch && Object.prototype.hasOwnProperty.call(BRANCHES, branch)) return branch;
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
