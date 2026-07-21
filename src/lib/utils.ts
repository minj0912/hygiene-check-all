import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getBranchIdFromUrl, getCurrentBranchInfo } from "./branch";
import type { InspectionTimeSlot } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 기존 오전/오후 점검 기록 호환용 함수입니다.
 *
 * 사용자 지정 시간대가 설정되지 않은 지점에서는
 * 기존 방식대로 오전/오후를 판단할 때 사용합니다.
 */
export function getPeriod(date: Date): "오전" | "오후" {
  return date.getHours() < 12 ? "오전" : "오후";
}

/**
 * HH:mm 형식의 시간이 유효한지 확인합니다.
 *
 * 허용 예:
 * - 09:00
 * - 11:30
 * - 23:59
 */
export function isValidTimeString(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hour, minute] = value.split(":").map(Number);

  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

/**
 * HH:mm 형식의 시간을 자정 기준 분 단위로 변환합니다.
 *
 * 예:
 * - 11:00 → 660
 * - 12:30 → 750
 */
export function timeStringToMinutes(value: string): number | null {
  if (!isValidTimeString(value)) return null;

  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Date 객체의 현재 시간을 자정 기준 분 단위로 변환합니다.
 */
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * 점검 시간대를 시작 시간과 order 순서대로 정렬합니다.
 *
 * 원본 배열은 변경하지 않고 새로운 배열을 반환합니다.
 */
export function sortInspectionTimeSlots(
  slots: InspectionTimeSlot[]
): InspectionTimeSlot[] {
  return [...slots].sort((a, b) => {
    const aStart = timeStringToMinutes(a.startTime) ?? 0;
    const bStart = timeStringToMinutes(b.startTime) ?? 0;

    if (aStart !== bStart) {
      return aStart - bStart;
    }

    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/**
 * 점검 시간대 데이터를 정리합니다.
 *
 * - 제목 앞뒤 공백 제거
 * - 시작/종료 시간 앞뒤 공백 제거
 * - 시작 시간 순서에 맞게 order 재설정
 */
export function normalizeInspectionTimeSlots(
  slots: InspectionTimeSlot[]
): InspectionTimeSlot[] {
  const cleaned = slots.map((slot) => ({
    ...slot,
    title: slot.title.trim(),
    startTime: slot.startTime.trim(),
    endTime: slot.endTime.trim(),
  }));

  return sortInspectionTimeSlots(cleaned).map((slot, index) => ({
    ...slot,
    order: index + 1,
  }));
}

/**
 * 현재 시간이 해당 점검 시간대 안에 있는지 확인합니다.
 *
 * 시작 시간은 포함하고 종료 시간은 포함하지 않습니다.
 *
 * 예:
 * 11:00~12:00인 경우
 * - 11:00 가능
 * - 11:59 가능
 * - 12:00 불가
 */
export function isTimeWithinInspectionSlot(
  date: Date,
  slot: InspectionTimeSlot
): boolean {
  const startMinutes = timeStringToMinutes(slot.startTime);
  const endMinutes = timeStringToMinutes(slot.endTime);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  if (endMinutes <= startMinutes) {
    return false;
  }

  const currentMinutes = dateToMinutes(date);

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * 현재 점검 가능한 시간대를 반환합니다.
 *
 * 현재 시간이 어떤 시간대에도 해당하지 않으면 null을 반환합니다.
 */
export function getActiveInspectionTimeSlot(
  slots: InspectionTimeSlot[],
  date: Date = new Date()
): InspectionTimeSlot | null {
  const sortedSlots = sortInspectionTimeSlots(slots);

  return (
    sortedSlots.find((slot) =>
      isTimeWithinInspectionSlot(date, slot)
    ) ?? null
  );
}

export interface NextInspectionTimeSlotResult {
  slot: InspectionTimeSlot;
  isTomorrow: boolean;
}

/**
 * 현재 시각 이후의 다음 점검 시간대를 반환합니다.
 *
 * 오늘 남은 점검 시간이 없으면 다음 날 첫 번째 시간대를 반환하며,
 * 이 경우 isTomorrow가 true가 됩니다.
 */
export function getNextInspectionTimeSlot(
  slots: InspectionTimeSlot[],
  date: Date = new Date()
): NextInspectionTimeSlotResult | null {
  const sortedSlots = sortInspectionTimeSlots(slots);

  if (sortedSlots.length === 0) {
    return null;
  }

  const currentMinutes = dateToMinutes(date);

  const nextToday = sortedSlots.find((slot) => {
    const startMinutes = timeStringToMinutes(slot.startTime);
    return startMinutes !== null && startMinutes > currentMinutes;
  });

  if (nextToday) {
    return {
      slot: nextToday,
      isTomorrow: false,
    };
  }

  return {
    slot: sortedSlots[0],
    isTomorrow: true,
  };
}

export interface InspectionTimeSlotValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * 관리자가 입력한 점검 시간대 설정을 검사합니다.
 *
 * 검사 내용:
 * - 제목 입력 여부
 * - 시간 형식
 * - 종료 시간이 시작 시간보다 늦은지
 * - 서로 겹치는 시간대가 있는지
 *
 * 11:00~12:00과 12:00~13:00처럼
 * 바로 이어지는 시간대는 허용합니다.
 */
export function validateInspectionTimeSlots(
  slots: InspectionTimeSlot[]
): InspectionTimeSlotValidationResult {
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const displayIndex = index + 1;

    if (!slot.title.trim()) {
      return {
        valid: false,
        message: `${displayIndex}번째 점검 시간의 제목을 입력해주세요.`,
      };
    }

    if (!isValidTimeString(slot.startTime)) {
      return {
        valid: false,
        message: `${slot.title || displayIndex + "번째"} 점검의 시작 시간이 올바르지 않습니다.`,
      };
    }

    if (!isValidTimeString(slot.endTime)) {
      return {
        valid: false,
        message: `${slot.title || displayIndex + "번째"} 점검의 종료 시간이 올바르지 않습니다.`,
      };
    }

    const startMinutes = timeStringToMinutes(slot.startTime);
    const endMinutes = timeStringToMinutes(slot.endTime);

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return {
        valid: false,
        message: `${slot.title} 점검의 종료 시간은 시작 시간보다 늦어야 합니다.`,
      };
    }
  }

  const sortedSlots = sortInspectionTimeSlots(slots);

  for (let index = 0; index < sortedSlots.length - 1; index += 1) {
    const currentSlot = sortedSlots[index];
    const nextSlot = sortedSlots[index + 1];

    const currentEnd = timeStringToMinutes(currentSlot.endTime);
    const nextStart = timeStringToMinutes(nextSlot.startTime);

    if (
      currentEnd !== null &&
      nextStart !== null &&
      currentEnd > nextStart
    ) {
      return {
        valid: false,
        message: `"${currentSlot.title}" 점검과 "${nextSlot.title}" 점검의 시간이 서로 겹칩니다.`,
      };
    }
  }

  return {
    valid: true,
  };
}

/**
 * 신규 점검 시간대 ID를 생성합니다.
 *
 * Firestore에 저장된 기존 시간대를 수정할 때는
 * 기존 ID를 그대로 유지해야 합니다.
 */
export function createInspectionTimeSlotId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `slot_${crypto.randomUUID()}`;
  }

  return `slot_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function toDate(
  val: Timestamp | Date | undefined | null
): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  return val.toDate();
}

export function formatDateTime(
  val: Timestamp | Date | undefined | null
): string {
  const date = toDate(val);

  if (!date) return "-";

  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");

  return `${m}월 ${d}일 ${h}:${min}`;
}

export function formatDateShort(
  val: Timestamp | Date | undefined | null
): string {
  const date = toDate(val);

  if (!date) return "-";

  const m = date.getMonth() + 1;
  const d = date.getDate();

  return `${m}월 ${d}일`;
}

export async function verifyPassword(
  input: string,
  mode: "inspector" | "admin"
): Promise<boolean> {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    const passwords: Record<"inspector" | "admin", string> = {
      inspector: "6400",
      admin: "6167",
    };

    return input === passwords[mode];
  }

  const branchInfo = getCurrentBranchInfo();
  const initialPassword = branchInfo?.initialPassword ?? "";
  const ref = doc(db, "branches", branchId, "settings", "auth");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        adminPassword: initialPassword,
        inspectorPassword: initialPassword,
      },
      { merge: true }
    );

    return input === initialPassword;
  }

  const data = snap.data() as Partial<{
    adminPassword: string;
    inspectorPassword: string;
  }>;

  const expected =
    mode === "admin"
      ? data.adminPassword || initialPassword
      : data.inspectorPassword || initialPassword;

  return input === expected;
}