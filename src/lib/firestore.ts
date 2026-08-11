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
import {
  Inspection,
  Complaint,
  Restroom,
  InspectionItem,
  InspectionTimeSlot,
} from "@/types";
import {
  getPeriod,
  normalizeInspectionTimeSlots,
} from "./utils";
import {
  DEFAULT_RESTROOMS,
  DEFAULT_INSPECTION_ITEMS,
} from "@/data/restrooms";
import {
  getBranchIdFromUrl,
  getCurrentBranchInfo,
  getDefaultRestroomsForCurrentBranch,
} from "./branch";

const DISCORD_BRIDGE_URL =
  "https://script.google.com/macros/s/AKfycbykTwt5DfTCpPVSdhGWhTgPjQiabN979NbZGfsAl_xGEYU6z-OH_bKW1VLagzNMepR-Qg/exec";

export interface BranchAuthSettings {
  adminPassword: string;
  inspectorPassword: string;
}

export interface BranchSettings {
  complaintUrl: string;
  complaintWebhookUrl: string;
  inspectionTimeSlots?: InspectionTimeSlot[];
}

type SubmitInspectionData = Omit<
  Inspection,
  | "id"
  | "checkedAt"
  | "period"
  | "status"
  | "timeSlotId"
  | "timeSlotTitle"
  | "timeSlotStart"
  | "timeSlotEnd"
> & {
  timeSlot?: InspectionTimeSlot | null;
};

function branchCollection(name: string) {
  const branchId = getBranchIdFromUrl();

  return branchId
    ? collection(db, "branches", branchId, name)
    : collection(db, name);
}

function branchDoc(name: string, id: string) {
  const branchId = getBranchIdFromUrl();

  return branchId
    ? doc(db, "branches", branchId, name, id)
    : doc(db, name, id);
}

function branchSettingsDoc(id: "auth" | "branch" | "inspectionTimes") {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    return doc(db, "settings", id);
  }

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

function defaultBranchSettings(): BranchSettings {
  const branchId = getBranchIdFromUrl();

  return {
    complaintUrl: "",
    complaintWebhookUrl: branchId ? "" : DISCORD_BRIDGE_URL,
    inspectionTimeSlots: [],
  };
}

function parseInspectionTimeSlots(value: unknown): InspectionTimeSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed = value.flatMap((rawSlot, index) => {
    if (!rawSlot || typeof rawSlot !== "object") {
      return [];
    }

    const slot = rawSlot as Partial<InspectionTimeSlot>;

    const title =
      typeof slot.title === "string"
        ? slot.title.trim()
        : "";

    const startTime =
      typeof slot.startTime === "string"
        ? slot.startTime.trim()
        : "";

    const endTime =
      typeof slot.endTime === "string"
        ? slot.endTime.trim()
        : "";

    if (!title || !startTime || !endTime) {
      return [];
    }

    const id =
      typeof slot.id === "string" && slot.id.trim()
        ? slot.id.trim()
        : `slot_${index + 1}`;

    const order =
      typeof slot.order === "number" && Number.isFinite(slot.order)
        ? slot.order
        : index + 1;

    return [
      {
        id,
        title,
        startTime,
        endTime,
        order,
      },
    ];
  });

  return normalizeInspectionTimeSlots(parsed);
}

function parseBranchDocument(value: unknown): BranchSettings {
  const defaults = defaultBranchSettings();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const data = value as Partial<BranchSettings>;

  return {
    complaintUrl:
      typeof data.complaintUrl === "string"
        ? data.complaintUrl
        : defaults.complaintUrl,

    complaintWebhookUrl:
      typeof data.complaintWebhookUrl === "string"
        ? data.complaintWebhookUrl
        : defaults.complaintWebhookUrl,

    // 이전 버전에서 settings/branch 문서에 저장했던 시간표입니다.
    // 새 버전에서는 settings/inspectionTimes 문서를 우선 사용합니다.
    inspectionTimeSlots: parseInspectionTimeSlots(
      data.inspectionTimeSlots
    ),
  };
}

function parseDedicatedTimeSettings(value: unknown): InspectionTimeSlot[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const data = value as {
    inspectionTimeSlots?: unknown;
  };

  return parseInspectionTimeSlots(
    data.inspectionTimeSlots
  );
}

async function seedRestroomsIfNeeded(restrooms: Restroom[]) {
  const branchId = getBranchIdFromUrl();

  if (!branchId) return;

  await Promise.all(
    restrooms.map((room) =>
      setDoc(
        branchDoc("restrooms", room.id),
        {
          floor: room.floor,
          name: room.name,
          locationLabel: room.locationLabel ?? "",
          order: room.order ?? 0,
        },
        {
          merge: true,
        }
      )
    )
  );
}

async function seedInspectionItemsIfNeeded(items: InspectionItem[]) {
  const branchId = getBranchIdFromUrl();

  if (!branchId) return;

  await Promise.all(
    items.map((item) =>
      setDoc(
        branchDoc("inspectionItems", item.id),
        {
          label: item.label,
          order: item.order,
        },
        {
          merge: true,
        }
      )
    )
  );
}

// ─── Restrooms ───────────────────────────────────────────────────────────────

export function subscribeRestrooms(
  callback: (rooms: Restroom[]) => void
): () => void {
  const q = query(
    branchCollection("restrooms"),
    orderBy("order", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        const defaults =
          getDefaultRestroomsForCurrentBranch(
            DEFAULT_RESTROOMS
          );

        callback(defaults);

        seedRestroomsIfNeeded(defaults).catch(
          (error) =>
            console.error(
              "기본 화장실 등록 실패:",
              error
            )
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
    () =>
      callback(
        getDefaultRestroomsForCurrentBranch(
          DEFAULT_RESTROOMS
        )
      )
  );
}

export async function addRestroom(
  data: Restroom
): Promise<void> {
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

  await setDoc(
    branchDoc("restrooms", id),
    payload,
    {
      merge: true,
    }
  );
}

export async function reorderRestrooms(
  restrooms: Restroom[]
): Promise<void> {
  const tasks = restrooms.map((room, index) =>
    updateRestroom(room.id, {
      order: index + 1,
    })
  );

  await Promise.all(tasks);
}

export async function deleteRestroom(
  id: string
): Promise<void> {
  await deleteDoc(
    branchDoc("restrooms", id)
  );
}

// ─── Inspection Items ────────────────────────────────────────────────────────

export function subscribeInspectionItems(
  callback: (items: InspectionItem[]) => void
): () => void {
  const q = query(
    branchCollection("inspectionItems"),
    orderBy("order", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(DEFAULT_INSPECTION_ITEMS);

        seedInspectionItemsIfNeeded(
          DEFAULT_INSPECTION_ITEMS
        ).catch((error) =>
          console.error(
            "기본 점검항목 등록 실패:",
            error
          )
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

export async function addInspectionItem(
  data: Omit<InspectionItem, "id">
): Promise<void> {
  await addDoc(
    branchCollection("inspectionItems"),
    data
  );
}

export async function updateInspectionItem(
  id: string,
  data: Partial<Omit<InspectionItem, "id">>
): Promise<void> {
  await setDoc(
    branchDoc("inspectionItems", id),
    data,
    {
      merge: true,
    }
  );
}

export async function deleteInspectionItem(
  id: string
): Promise<void> {
  await deleteDoc(
    branchDoc("inspectionItems", id)
  );
}

// ─── Inspections ─────────────────────────────────────────────────────────────

export function subscribeLatestInspectionByRestroom(
  restroomId: string,
  callback: (inspection: Inspection | null) => void
): () => void {
  const q = query(
    branchCollection("inspections"),
    orderBy("checkedAt", "desc")
  );

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
      console.error(
        "subscribeLatestInspectionByRestroom error:",
        error
      );
      callback(null);
    }
  );
}

export async function submitInspection(
  data: SubmitInspectionData
): Promise<void> {
  const now = new Date();
  const {
    timeSlot,
    ...inspectionData
  } = data;

  const slotTitle =
    timeSlot?.title?.trim() ?? "";

  const payload: Record<string, unknown> = {
    ...inspectionData,
    checkedAt: Timestamp.fromDate(now),
    period: slotTitle || getPeriod(now),
    status: "completed",
  };

  if (timeSlot && slotTitle) {
    payload.timeSlotId = timeSlot.id;
    payload.timeSlotTitle = slotTitle;
    payload.timeSlotStart = timeSlot.startTime;
    payload.timeSlotEnd = timeSlot.endTime;
  }

  await addDoc(
    branchCollection("inspections"),
    payload
  );
}

export function subscribeAllLatestInspections(
  restroomIds: string[],
  callback: (map: Record<string, Inspection>) => void
): () => void {
  if (restroomIds.length === 0) {
    callback({});
    return () => {};
  }

  const q = query(
    branchCollection("inspections"),
    orderBy("checkedAt", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, Inspection> = {};

      snap.docs.forEach((d) => {
        const data = {
          id: d.id,
          ...d.data(),
        } as Inspection;

        if (
          restroomIds.includes(data.restroomId) &&
          !map[data.restroomId]
        ) {
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
    where(
      "checkedAt",
      ">=",
      Timestamp.fromDate(start)
    ),
    where(
      "checkedAt",
      "<=",
      Timestamp.fromDate(end)
    ),
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

  if (!branchId) {
    return DISCORD_BRIDGE_URL;
  }

  const snap = await getDoc(
    branchSettingsDoc("branch")
  );

  const data =
    snap.data() as Partial<BranchSettings> | undefined;

  return (
    data?.complaintWebhookUrl ?? ""
  ).trim();
}

async function sendDiscordComplaintAlert(data: {
  title: string;
  location: string;
  detail: string;
  restroomName: string;
}) {
  const webhookUrl = await getComplaintWebhookUrl();

  if (!webhookUrl) return;

  const createdAt =
    new Date().toLocaleString("ko-KR");

  const response = await fetch(
    webhookUrl,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        title: data.title,
        restroomName: data.restroomName,
        location: data.location,
        detail: data.detail,
        createdAt,
      }),
    }
  );

  const text = await response.text();

  console.log(
    "Apps Script response status:",
    response.status
  );
  console.log(
    "Apps Script response body:",
    text
  );

  if (!response.ok) {
    throw new Error(
      `Discord bridge 요청 실패: ${response.status} ${text}`
    );
  }
}

export async function submitComplaint(
  data: Omit<
    Complaint,
    | "id"
    | "createdAt"
    | "isRead"
    | "isResolved"
    | "readAt"
    | "resolvedAt"
  >
): Promise<void> {
  await addDoc(
    branchCollection("complaints"),
    {
      ...data,
      createdAt: Timestamp.fromDate(
        new Date()
      ),
      isRead: false,
      isResolved: false,
      readAt: null,
      resolvedAt: null,
    }
  );

  try {
    await sendDiscordComplaintAlert({
      title: data.title,
      location: data.location,
      detail: data.detail,
      restroomName: data.restroomName,
    });
  } catch (error) {
    console.error(
      "Discord 알림 전송 실패:",
      error
    );
  }
}

export function subscribeComplaints(
  callback: (complaints: Complaint[]) => void
): () => void {
  const q = query(
    branchCollection("complaints"),
    orderBy("createdAt", "desc")
  );

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

export async function markComplaintRead(
  id: string
): Promise<void> {
  await updateDoc(
    branchDoc("complaints", id),
    {
      isRead: true,
      readAt: Timestamp.fromDate(
        new Date()
      ),
    }
  );
}

export async function markComplaintResolved(
  id: string
): Promise<void> {
  await updateDoc(
    branchDoc("complaints", id),
    {
      isResolved: true,
      resolvedAt: Timestamp.fromDate(
        new Date()
      ),
    }
  );
}

// ─── Branch Settings ─────────────────────────────────────────────────────────

export async function getBranchAuthSettings(): Promise<BranchAuthSettings> {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    return {
      adminPassword: "6167",
      inspectorPassword: "6400",
    };
  }

  const ref = branchSettingsDoc("auth");
  const snap = await getDoc(ref);
  const defaults = defaultAuthSettings();

  if (!snap.exists()) {
    await setDoc(
      ref,
      defaults,
      {
        merge: true,
      }
    );

    return defaults;
  }

  const data =
    snap.data() as Partial<BranchAuthSettings>;

  const branchInfo = getCurrentBranchInfo();

  if (
    branchInfo?.legacyInitialPassword &&
    data.adminPassword ===
      branchInfo.legacyInitialPassword &&
    data.inspectorPassword ===
      branchInfo.legacyInitialPassword
  ) {
    await setDoc(
      ref,
      defaults,
      {
        merge: true,
      }
    );

    return defaults;
  }

  return {
    adminPassword:
      data.adminPassword ||
      defaults.adminPassword,

    inspectorPassword:
      data.inspectorPassword ||
      defaults.inspectorPassword,
  };
}

export async function updateBranchAuthSettings(
  settings: BranchAuthSettings
): Promise<void> {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    throw new Error(
      "무역센터점 기존 비밀번호는 이 화면에서 변경하지 않습니다."
    );
  }

  await setDoc(
    branchSettingsDoc("auth"),
    {
      adminPassword:
        settings.adminPassword.trim(),

      inspectorPassword:
        settings.inspectorPassword.trim(),
    },
    {
      merge: true,
    }
  );
}

/**
* 지점 설정을 읽기만 합니다.
*
* 중요:
* 읽기 실패/문서 없음 상황에서 기본값을 Firestore에 자동 저장하지 않습니다.
* 고객/점검자 화면의 읽기 작업이 설정을 덮어쓰는 일을 방지합니다.
*
* 점검 시간표는 새 전용 문서(settings/inspectionTimes)를 우선 사용하고,
* 전용 문서가 아직 없으면 이전 버전의 settings/branch.inspectionTimeSlots를
* 호환용으로 읽습니다.
*/
export async function getBranchSettings(): Promise<BranchSettings> {
  const branchId = getBranchIdFromUrl();
  const defaults = defaultBranchSettings();

  if (!branchId) {
    return defaults;
  }

  const branchRef = branchSettingsDoc("branch");
  const timeRef = branchSettingsDoc("inspectionTimes");

  const [branchSnap, timeSnap] = await Promise.all([
    getDoc(branchRef),
    getDoc(timeRef),
  ]);

  const branchSettings = branchSnap.exists()
    ? parseBranchDocument(branchSnap.data())
    : defaults;

  const legacySlots =
    branchSettings.inspectionTimeSlots ?? [];

  const inspectionTimeSlots = timeSnap.exists()
    ? parseDedicatedTimeSettings(timeSnap.data())
    : legacySlots;

  return {
    complaintUrl:
      branchSettings.complaintUrl ?? "",
    complaintWebhookUrl:
      branchSettings.complaintWebhookUrl ?? "",
    inspectionTimeSlots,
  };
}

/**
* 지점 설정을 실시간으로 읽습니다.
*
* 중요:
* - 구독 오류 시 []를 callback 하지 않습니다.
* - 문서가 없다고 해서 기본값을 Firestore에 자동 생성하지 않습니다.
* - 정상적으로 한 번 읽은 설정은 일시적인 네트워크 오류로 덮어쓰지 않습니다.
*
* 전용 시간표 문서가 존재하면 그 값(빈 배열 포함)을 최우선으로 사용합니다.
* 전용 문서가 없을 때만 이전 branch 문서의 시간표를 사용합니다.
*/
export function subscribeBranchSettings(
  callback: (settings: BranchSettings) => void
): () => void {
  const branchId = getBranchIdFromUrl();
  const defaults = defaultBranchSettings();

  if (!branchId) {
    callback(defaults);
    return () => {};
  }

  const branchRef = branchSettingsDoc("branch");
  const timeRef = branchSettingsDoc("inspectionTimes");

  let branchLoaded = false;
  let timeLoaded = false;

  let branchSettings: BranchSettings = defaults;
  let legacySlots: InspectionTimeSlot[] = [];

  let dedicatedTimeDocExists = false;
  let dedicatedSlots: InspectionTimeSlot[] = [];

  const emitIfReady = () => {
    if (!branchLoaded || !timeLoaded) {
      return;
    }

    callback({
      complaintUrl:
        branchSettings.complaintUrl ?? "",
      complaintWebhookUrl:
        branchSettings.complaintWebhookUrl ?? "",
      inspectionTimeSlots:
        dedicatedTimeDocExists
          ? dedicatedSlots
          : legacySlots,
    });
  };

  const unsubscribeBranch = onSnapshot(
    branchRef,
    (snap) => {
      branchLoaded = true;

      if (snap.exists()) {
        branchSettings =
          parseBranchDocument(snap.data());
        legacySlots =
          branchSettings.inspectionTimeSlots ?? [];
      } else {
        branchSettings = defaults;
        legacySlots = [];
      }

      emitIfReady();
    },
    (error) => {
      console.error(
        "subscribeBranchSettings(branch) error:",
        error
      );

      // 기존 화면 상태를 유지하기 위해 callback(defaults)를 호출하지 않습니다.
    }
  );

  const unsubscribeTimes = onSnapshot(
    timeRef,
    (snap) => {
      timeLoaded = true;
      dedicatedTimeDocExists = snap.exists();

      dedicatedSlots = snap.exists()
        ? parseDedicatedTimeSettings(
            snap.data()
          )
        : [];

      emitIfReady();
    },
    (error) => {
      console.error(
        "subscribeBranchSettings(inspectionTimes) error:",
        error
      );

      // 기존 화면 상태를 유지하기 위해 빈 배열을 전달하지 않습니다.
    }
  );

  return () => {
    unsubscribeBranch();
    unsubscribeTimes();
  };
}

/**
* 민원 관련 지점 설정만 저장합니다.
*
* 중요:
* 이 함수는 inspectionTimeSlots를 절대 수정하지 않습니다.
* 오래된 화면/캐시에서 지점 설정을 저장하더라도 시간표가 빈 배열로
* 덮어써지는 것을 막기 위한 방어 로직입니다.
*/
export async function updateBranchSettings(
  settings: BranchSettings
): Promise<void> {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    throw new Error(
      "지점별 설정은 지점 전용 화면에서만 변경할 수 있습니다."
    );
  }

  await setDoc(
    branchSettingsDoc("branch"),
    {
      complaintUrl:
        settings.complaintUrl.trim(),

      complaintWebhookUrl:
        settings.complaintWebhookUrl.trim(),
    },
    {
      merge: true,
    }
  );
}

/**
* 점검 시간표는 별도의 전용 문서에만 저장합니다.
*
* settings/branch와 분리했기 때문에 비밀번호/민원 설정 저장이나
* 오래된 관리 화면의 저장 동작이 시간표를 지울 수 없습니다.
*
* 빈 배열은 관리자가 실제로 모든 시간대를 삭제한 뒤 저장한 경우에만
* 이 함수를 통해 명시적으로 저장됩니다.
*/
export async function updateInspectionTimeSlots(
  slots: InspectionTimeSlot[]
): Promise<void> {
  const branchId = getBranchIdFromUrl();

  if (!branchId) {
    throw new Error(
      "점검 시간 설정은 지점 전용 화면에서만 변경할 수 있습니다."
    );
  }

  const normalizedSlots =
    normalizeInspectionTimeSlots(slots)
      .map((slot) => ({
        id: slot.id,
        title: slot.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        order: slot.order,
      }));

  await setDoc(
    branchSettingsDoc("inspectionTimes"),
    {
      inspectionTimeSlots:
        normalizedSlots,
      schemaVersion: 2,
      updatedAt: Timestamp.fromDate(
        new Date()
      ),
    },
    {
      merge: true,
    }
  );
}
