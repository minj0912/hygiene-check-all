import { InspectionItem, Restroom } from "@/types";

export const DEFAULT_RESTROOMS: Restroom[] = [
  { id: "10f_women_1", floor: "10F", name: "10층 여자화장실 1", locationLabel: "10층 에스컬레이터 옆", order: 1 },
  { id: "10f_men_1",   floor: "10F", name: "10층 남자화장실 1", locationLabel: "10층 계단 옆",       order: 2 },
  { id: "9f_women_1",  floor: "9F",  name: "9층 여자화장실 1",  locationLabel: "9층 에스컬레이터 옆",  order: 3 },
  { id: "9f_men_1",    floor: "9F",  name: "9층 남자화장실 1",  locationLabel: "9층 계단 옆",         order: 4 },
  { id: "8f_women_1",  floor: "8F",  name: "8층 여자화장실 1",  locationLabel: "8층 에스컬레이터 옆",  order: 5 },
  { id: "8f_men_1",    floor: "8F",  name: "8층 남자화장실 1",  locationLabel: "8층 계단 옆",         order: 6 },
];

export const DEFAULT_INSPECTION_ITEMS: InspectionItem[] = [
  { id: "toilet",  label: "좌변기",    order: 1 },
  { id: "urinal",  label: "소변기",    order: 2 },
  { id: "paper",   label: "휴지",      order: 3 },
  { id: "bin",     label: "휴지통",    order: 4 },
  { id: "sink",    label: "세면대",    order: 5 },
  { id: "mirror",  label: "거울",      order: 6 },
  { id: "towel",   label: "페이퍼타올", order: 7 },
  { id: "soap",    label: "비누",      order: 8 },
  { id: "floor",   label: "바닥/벽",   order: 9 },
  { id: "vent",    label: "환기",      order: 10 },
  { id: "notices", label: "부착물",    order: 11 },
];

export const FLOOR_ORDER = ["10F", "9F", "8F"];
