import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getBranchIdFromUrl, getCurrentBranchInfo } from "./branch";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPeriod(date: Date): "오전" | "오후" {
  return date.getHours() < 12 ? "오전" : "오후";
}

export function toDate(val: Timestamp | Date | undefined | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  return val.toDate();
}

export function formatDateTime(val: Timestamp | Date | undefined | null): string {
  const date = toDate(val);
  if (!date) return "-";
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${m}월 ${d}일 ${h}:${min}`;
}

export function formatDateShort(val: Timestamp | Date | undefined | null): string {
  const date = toDate(val);
  if (!date) return "-";
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일`;
}

export async function verifyPassword(input: string, mode: "inspector" | "admin"): Promise<boolean> {
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
    await setDoc(ref, {
      adminPassword: initialPassword,
      inspectorPassword: initialPassword,
    }, { merge: true });
    return input === initialPassword;
  }

  const data = snap.data() as Partial<{ adminPassword: string; inspectorPassword: string }>;
  const expected = mode === "admin"
    ? (data.adminPassword || initialPassword)
    : (data.inspectorPassword || initialPassword);

  return input === expected;
}
