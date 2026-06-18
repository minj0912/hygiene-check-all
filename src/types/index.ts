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

export interface Inspection {
  id?: string;
  restroomId: string;
  restroomName: string;
  floor: string;
  inspectorName: string;
  checkedAt: Timestamp | Date;
  period: "오전" | "오후";
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