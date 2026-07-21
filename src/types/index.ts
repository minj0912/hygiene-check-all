import { Timestamp } from "firebase/firestore";

export interface Restroom {
  id: string;
  floor: string;
  name: string;
  locationLabel: string;
  order?: number;
}

export interface InspectionItem {
  id: string;
  label: string;
  order: number;
}

export type ItemResult = "O" | "X";

/**
 * 지점 관리자가 설정하는 점검 시간대
 *
 * 예시:
 * {
 *   id: "slot_1",
 *   title: "11시",
 *   startTime: "11:00",
 *   endTime: "12:00",
 *   order: 1
 * }
 */
export interface InspectionTimeSlot {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  order: number;
}

/**
 * 화장실 점검 기록
 *
 * 기존 기록:
 * period: "오전" 또는 "오후"
 *
 * 신규 기록:
 * period: 관리자가 입력한 제목
 * timeSlotId, timeSlotTitle, timeSlotStart, timeSlotEnd 함께 저장
 */
export interface Inspection {
  id?: string;
  restroomId: string;
  restroomName: string;
  floor: string;
  inspectorName: string;
  checkedAt: Timestamp | Date;

  /**
   * 기존 오전/오후 기록과 신규 사용자 지정 제목을 모두 지원합니다.
   * 예: "오전", "오후", "11시", "마감 점검"
   */
  period: string;

  /**
   * 사용자 지정 점검 시간대 정보
   * 기존 오전/오후 기록에는 존재하지 않을 수 있습니다.
   */
  timeSlotId?: string;
  timeSlotTitle?: string;
  timeSlotStart?: string;
  timeSlotEnd?: string;

  status: "completed";
  items: Record<string, ItemResult>;
}

export interface Complaint {
  id?: string;
  title: string;
  location: string;
  detail: string;
  restroomId: string;
  restroomName: string;
  createdAt: Timestamp | Date;
  isRead: boolean;
  isResolved: boolean;
  readAt?: Timestamp | Date | null;
  resolvedAt?: Timestamp | Date | null;
}

export type AppMode = "home" | "inspector" | "admin";