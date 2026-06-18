import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Inspection, Complaint, Restroom, InspectionItem } from "@/types";
import { getPeriod } from "./utils";
import { DEFAULT_RESTROOMS, DEFAULT_INSPECTION_ITEMS } from "@/data/restrooms";
import { getBranchIdFromUrl, getCurrentBranchInfo, getDefaultRestroomsForCurrentBranch } from "./branch";

const DISCORD_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbykTwt5DfTCpPVSdhGWhTgPjQiabN979NbZGfsAl_xGEYU6z-OH_bKW1VLagzNMepR-Qg/exec";

export interface BranchAuthSettings {
  adminPassword: string;
  inspectorPassword: string;
}

export interface BranchSettings {
  complaintUrl: string;
  complaintWebhookUrl: string;
}

function branchCollection(name: string) {
  const branchId = getBranchIdFromUrl();
  return branchId ? collection(db, "branches", branchId, name) : collection(db, name);
}

function branchDoc(name: string, id: string) {
  const branchId = getBranchIdFromUrl();
  return branchId ? doc(db, "branches", branchId, name, id) : doc(db, name, id);
}

function branchSettingsDoc(id: "auth" | "branch") {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return doc(db, "settings", id);
  return doc(db, "branches", branchId, "settings", id);
}

function defaultAuthSettings(): BranchAuthSettings {
  const branchInfo = getCurrentBranchInfo();
  const password = branchInfo?.initialPassword ?? "";
  return {
    adminPassword: password,
    inspectorPassword: password,
  };
}

async function seedRestroomsIfNeeded(restrooms: Restroom[]) {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return;
  await Promise.all(
    restrooms.map((room) =>
      setDoc(branchDoc("restrooms", room.id), {
        floor: room.floor,
        name: room.name,
        locationLabel: room.locationLabel ?? "",
        order: room.order ?? 0,
      }, { merge: true })
    )
  );
}

async function seedInspectionItemsIfNeeded(items: InspectionItem[]) {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return;
  await Promise.all(
    items.map((item) =>
      setDoc(branchDoc("inspectionItems", item.id), {
        label: item.label,
        order: item.order,
      }, { merge: true })
    )
  );
}

// ─── Restrooms ───────────────────────────────────────────────────────────────

export function subscribeRestrooms(callback: (rooms: Restroom[]) => void): () => void {
  const q = query(branchCollection("restrooms"), orderBy("order", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        const defaults = getDefaultRestroomsForCurrentBranch(DEFAULT_RESTROOMS);
        callback(defaults);
        seedRestroomsIfNeeded(defaults).catch((error) =>
          console.error("기본 화장실 등록 실패:", error)
        );
        return;
      }

      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Restroom[]
      );
    },
    () => callback(getDefaultRestroomsForCurrentBranch(DEFAULT_RESTROOMS))
  );
}

export async function addRestroom(data: Restroom): Promise<void> {
  const customId = data.id.trim().toLowerCase();

  if (!customId) {
    throw new Error("화장실 ID가 비어 있습니다.");
  }

  const docRef = branchDoc("restrooms", customId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    throw new Error("이미 사용 중인 화장실 ID입니다.");
  }

  await setDoc(docRef, {
    floor: data.floor.trim(),
    name: data.name.trim(),
    locationLabel: (data.locationLabel ?? "").trim(),
    order: data.order ?? 0,
  });
}

export async function updateRestroom(
  id: string,
  data: Partial<Omit<Restroom, "id">>
): Promise<void> {
  const payload: Partial<Omit<Restroom, "id">> = {};

  if (data.floor !== undefined) {
    payload.floor = data.floor.trim();
  }

  if (data.name !== undefined) {
    payload.name = data.name.trim();
  }

  if (data.locationLabel !== undefined) {
    payload.locationLabel = data.locationLabel.trim();
  }

  if (data.order !== undefined) {
    payload.order = data.order;
  }

  await setDoc(branchDoc("restrooms", id), payload, { merge: true });
}

export async function reorderRestrooms(restrooms: Restroom[]): Promise<void> {
  const tasks = restrooms.map((room, index) =>
    updateRestroom(room.id, { order: index + 1 })
  );

  await Promise.all(tasks);
}

export async function deleteRestroom(id: string): Promise<void> {
  await deleteDoc(branchDoc("restrooms", id));
}

// ─── Inspection Items ────────────────────────────────────────────────────────

export function subscribeInspectionItems(callback: (items: InspectionItem[]) => void): () => void {
  const q = query(branchCollection("inspectionItems"), orderBy("order", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(DEFAULT_INSPECTION_ITEMS);
        seedInspectionItemsIfNeeded(DEFAULT_INSPECTION_ITEMS).catch((error) =>
          console.error("기본 점검항목 등록 실패:", error)
        );
        return;
      }

      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as InspectionItem[]
      );
    },
    () => callback(DEFAULT_INSPECTION_ITEMS)
  );
}

export async function addInspectionItem(data: Omit<InspectionItem, "id">): Promise<void> {
  await addDoc(branchCollection("inspectionItems"), data);
}

export async function updateInspectionItem(
  id: string,
  data: Partial<Omit<InspectionItem, "id">>
): Promise<void> {
  await setDoc(branchDoc("inspectionItems", id), data, { merge: true });
}

export async function deleteInspectionItem(id: string): Promise<void> {
  await deleteDoc(branchDoc("inspectionItems", id));
}

// ─── Inspections ─────────────────────────────────────────────────────────────

export function subscribeLatestInspectionByRestroom(
  restroomId: string,
  callback: (inspection: Inspection | null) => void
): () => void {
  const q = query(branchCollection("inspections"), orderBy("checkedAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const found = snap.docs.find((d) => {
        const data = d.data() as Inspection;
        return data.restroomId === restroomId;
      });

      if (!found) {
        callback(null);
        return;
      }

      callback({
        id: found.id,
        ...found.data(),
      } as Inspection);
    },
    (error) => {
      console.error("subscribeLatestInspectionByRestroom error:", error);
      callback(null);
    }
  );
}

export async function submitInspection(
  data: Omit<Inspection, "id" | "checkedAt" | "period" | "status">
): Promise<void> {
  const now = new Date();

  await addDoc(branchCollection("inspections"), {
    ...data,
    checkedAt: Timestamp.fromDate(now),
    period: getPeriod(now),
    status: "completed",
  });
}

export function subscribeAllLatestInspections(
  restroomIds: string[],
  callback: (map: Record<string, Inspection>) => void
): () => void {
  if (restroomIds.length === 0) {
    callback({});
    return () => {};
  }

  const q = query(branchCollection("inspections"), orderBy("checkedAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, Inspection> = {};

      snap.docs.forEach((d) => {
        const data = {
          id: d.id,
          ...d.data(),
        } as Inspection;

        if (restroomIds.includes(data.restroomId) && !map[data.restroomId]) {
          map[data.restroomId] = data;
        }
      });

      callback(map);
    },
    () => callback({})
  );
}

// ─── 특정 날짜 점검 기록 ────────────────────────────────────────────────────

export function subscribeInspectionsByDate(
  date: Date,
  callback: (inspections: Inspection[]) => void
): () => void {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const q = query(
    branchCollection("inspections"),
    where("checkedAt", ">=", Timestamp.fromDate(start)),
    where("checkedAt", "<=", Timestamp.fromDate(end)),
    orderBy("checkedAt", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Inspection[]
      );
    },
    () => callback([])
  );
}

// ─── Complaints ──────────────────────────────────────────────────────────────

async function getComplaintWebhookUrl(): Promise<string> {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return DISCORD_BRIDGE_URL;

  const snap = await getDoc(branchSettingsDoc("branch"));
  const data = snap.data() as Partial<BranchSettings> | undefined;
  return (data?.complaintWebhookUrl ?? "").trim();
}

async function sendDiscordComplaintAlert(data: {
  title: string;
  location: string;
  detail: string;
  restroomName: string;
}) {
  const webhookUrl = await getComplaintWebhookUrl();
  if (!webhookUrl) return;

  const createdAt = new Date().toLocaleString("ko-KR");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      title: data.title,
      restroomName: data.restroomName,
      location: data.location,
      detail: data.detail,
      createdAt,
    }),
  });

  const text = await response.text();
  console.log("Apps Script response status:", response.status);
  console.log("Apps Script response body:", text);

  if (!response.ok) {
    throw new Error(`Discord bridge 요청 실패: ${response.status} ${text}`);
  }
}

export async function submitComplaint(
  data: Omit<Complaint, "id" | "createdAt" | "isRead" | "isResolved" | "readAt" | "resolvedAt">
): Promise<void> {
  await addDoc(branchCollection("complaints"), {
    ...data,
    createdAt: Timestamp.fromDate(new Date()),
    isRead: false,
    isResolved: false,
    readAt: null,
    resolvedAt: null,
  });

  try {
    await sendDiscordComplaintAlert({
      title: data.title,
      location: data.location,
      detail: data.detail,
      restroomName: data.restroomName,
    });
  } catch (error) {
    console.error("Discord 알림 전송 실패:", error);
  }
}

export function subscribeComplaints(callback: (complaints: Complaint[]) => void): () => void {
  const q = query(branchCollection("complaints"), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Complaint[]
      );
    },
    () => callback([])
  );
}

export async function markComplaintRead(id: string): Promise<void> {
  await updateDoc(branchDoc("complaints", id), {
    isRead: true,
    readAt: Timestamp.fromDate(new Date()),
  });
}

export async function markComplaintResolved(id: string): Promise<void> {
  await updateDoc(branchDoc("complaints", id), {
    isResolved: true,
    resolvedAt: Timestamp.fromDate(new Date()),
  });
}

// ─── Branch Settings ───────────────────────────────────────────────────────

export async function getBranchAuthSettings(): Promise<BranchAuthSettings> {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return { adminPassword: "6167", inspectorPassword: "6400" };

  const ref = branchSettingsDoc("auth");
  const snap = await getDoc(ref);
  const defaults = defaultAuthSettings();

  if (!snap.exists()) {
    await setDoc(ref, defaults, { merge: true });
    return defaults;
  }

  const data = snap.data() as Partial<BranchAuthSettings>;
  const branchInfo = getCurrentBranchInfo();

  // 기존 테스트 버전의 초기 비밀번호(예: 0001/0003)가 저장되어 있는 경우에는
  // 새 초기 비밀번호로 1회 자동 보정합니다. 관리자가 이미 다른 번호로 바꾼 경우에는 덮어쓰지 않습니다.
  if (
    branchInfo?.legacyInitialPassword &&
    data.adminPassword === branchInfo.legacyInitialPassword &&
    data.inspectorPassword === branchInfo.legacyInitialPassword
  ) {
    await setDoc(ref, defaults, { merge: true });
    return defaults;
  }

  return {
    adminPassword: data.adminPassword || defaults.adminPassword,
    inspectorPassword: data.inspectorPassword || defaults.inspectorPassword,
  };
}

export async function updateBranchAuthSettings(settings: BranchAuthSettings): Promise<void> {
  const branchId = getBranchIdFromUrl();
  if (!branchId) {
    throw new Error("무역센터점 기존 비밀번호는 이 화면에서 변경하지 않습니다.");
  }

  await setDoc(branchSettingsDoc("auth"), {
    adminPassword: settings.adminPassword.trim(),
    inspectorPassword: settings.inspectorPassword.trim(),
  }, { merge: true });
}

export async function getBranchSettings(): Promise<BranchSettings> {
  const branchId = getBranchIdFromUrl();
  if (!branchId) return { complaintUrl: "", complaintWebhookUrl: DISCORD_BRIDGE_URL };

  const ref = branchSettingsDoc("branch");
  const snap = await getDoc(ref);
  const defaults: BranchSettings = { complaintUrl: "", complaintWebhookUrl: "" };

  if (!snap.exists()) {
    await setDoc(ref, defaults, { merge: true });
    return defaults;
  }

  const data = snap.data() as Partial<BranchSettings>;
  return {
    complaintUrl: data.complaintUrl || "",
    complaintWebhookUrl: data.complaintWebhookUrl || "",
  };
}

export async function updateBranchSettings(settings: BranchSettings): Promise<void> {
  const branchId = getBranchIdFromUrl();
  if (!branchId) {
    throw new Error("지점 설정은 본점/천호점에서만 사용합니다.");
  }

  await setDoc(branchSettingsDoc("branch"), {
    complaintUrl: settings.complaintUrl.trim(),
    complaintWebhookUrl: settings.complaintWebhookUrl.trim(),
  }, { merge: true });
}
