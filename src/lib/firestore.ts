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

  /**
   * 관리자가 설정한 지점별 점검 시간대입니다.
   *
   * 기존 지점 설정 문서에는 이 값이 없을 수 있으므로
   * 선택 속성으로 두고, 불러올 때 빈 배열로 보정합니다.
   */
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
  /**
   * 사용자 지정 점검 시간대가 설정된 경우 전달합니다.
   *
   * 전달하지 않으면 기존 오전/오후 방식으로 저장됩니다.
   */
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

function branchSettingsDoc(id: "auth" | "branch") {
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

/**
 * Firestore에서 가져온 점검 시간표를 안전한 형태로 변환합니다.
 *
 * 기존 설정 문서에 시간표가 없거나,
 * 일부 값이 잘못 저장되어 있더라도 화면이 중단되지 않도록 처리합니다.
 */
function parseInspectionTimeSlots(value: unknown): InspectionTimeSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed = value.flatMap((rawSlot, index) => {
    if (
      !rawSlot ||
      typeof rawSlot !== "object"
    ) {
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
      typeof slot.order === "number" &&
      Number.isFinite(slot.order)
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

function parseBranchSettings(value: unknown): BranchSettings {
  const defaults = defaultBranchSettings();

  if (
    !value ||
    typeof value !== "object"
  ) {
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

    inspectionTimeSlots: parseInspectionTimeSlots(
      data.inspectionTimeSlots
    ),
  };
}

async function seedRestroomsIfNeeded(
  restrooms: Restroom[]
) {
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

async function seedInspectionItemsIfNeeded(
  items: InspectionItem[]
) {
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
    throw new Error(
      "화장실 ID가 비어 있습니다."
    );
  }

  const docRef = branchDoc(
    "restrooms",
    customId
  );

  const snap = await getDoc(docRef);

  if (snap.exists()) {
    throw new Error(
      "이미 사용 중인 화장실 ID입니다."
    );
  }

  await setDoc(docRef, {
    floor: data.floor.trim(),
    name: data.name.trim(),
    locationLabel:
      (data.locationLabel ?? "").trim(),
    order: data.order ?? 0,
  });
}

export async function updateRestroom(
  id: string,
  data: Partial<Omit<Restroom, "id">>
): Promise<void> {
  const payload: Partial<
    Omit<Restroom, "id">
  > = {};

  if (data.floor !== undefined) {
    payload.floor = data.floor.trim();
  }

  if (data.name !== undefined) {
    payload.name = data.name.trim();
  }

  if (data.locationLabel !== undefined) {
    payload.locationLabel =
      data.locationLabel.trim();
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
  const tasks = restrooms.map(
    (room, index) =>
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
  callback: (
    items: InspectionItem[]
  ) => void
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
    () =>
      callback(DEFAULT_INSPECTION_ITEMS)
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
  data: Partial<
    Omit<InspectionItem, "id">
  >
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
  callback: (
    inspection: Inspection | null
  ) => void
): () => void {
  const q = query(
    branchCollection("inspections"),
    orderBy("checkedAt", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const found = snap.docs.find((d) => {
        const data =
          d.data() as Inspection;

        return (
          data.restroomId === restroomId
        );
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

/**
 * 점검 기록을 저장합니다.
 *
 * timeSlot이 전달되면:
 * - 관리자가 입력한 제목을 period에 저장
 * - 시간대 ID, 제목, 시작 시간, 종료 시간 저장
 *
 * timeSlot이 없으면:
 * - 기존 오전/오후 방식으로 저장
 */
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
    period:
      slotTitle || getPeriod(now),
    status: "completed",
  };

  if (timeSlot && slotTitle) {
    payload.timeSlotId = timeSlot.id;
    payload.timeSlotTitle = slotTitle;
    payload.timeSlotStart =
      timeSlot.startTime;
    payload.timeSlotEnd =
      timeSlot.endTime;
  }

  await addDoc(
    branchCollection("inspections"),
    payload
  );
}

export function subscribeAllLatestInspections(
  restroomIds: string[],
  callback: (
    map: Record<string, Inspection>
  ) => void
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
      const map: Record<
        string,
        Inspection
      > = {};

      snap.docs.forEach((d) => {
        const data = {
          id: d.id,
          ...d.data(),
        } as Inspection;

        if (
          restroomIds.includes(
            data.restroomId
          ) &&
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
  callback: (
    inspections: Inspection[]
  ) => void
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
    snap.data() as
      | Partial<BranchSettings>
      | undefined;

  return (
    data?.complaintWebhookUrl ?? ""
  ).trim();
}

async function sendDiscordComplaintAlert(
  data: {
    title: string;
    location: string;
    detail: string;
    restroomName: string;
  }
) {
  const webhookUrl =
    await getComplaintWebhookUrl();

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
        restroomName:
          data.restroomName,
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
      restroomName:
        data.restroomName,
    });
  } catch (error) {
    console.error(
      "Discord 알림 전송 실패:",
      error
    );
  }
}

export function subscribeComplaints(
  callback: (
    complaints: Complaint[]
  ) => void
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

  const ref =
    branchSettingsDoc("auth");

  const snap = await getDoc(ref);
  const defaults =
    defaultAuthSettings();

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
    snap.data() as
      Partial<BranchAuthSettings>;

  const branchInfo =
    getCurrentBranchInfo();

  /**
   * 기존 테스트 버전의 초기 비밀번호가 저장되어 있는 경우에는
   * 새로운 초기 비밀번호로 한 번 자동 보정합니다.
   *
   * 관리자가 이미 다른 번호로 변경한 경우에는 덮어쓰지 않습니다.
   */
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
 * 현재 지점 설정을 한 번 불러옵니다.
 */
export async function getBranchSettings(): Promise<BranchSettings> {
  const branchId = getBranchIdFromUrl();
  const defaults =
    defaultBranchSettings();

  if (!branchId) {
    return defaults;
  }

  const ref =
    branchSettingsDoc("branch");

  const snap = await getDoc(ref);

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

  return parseBranchSettings(
    snap.data()
  );
}

/**
 * 지점 설정을 실시간으로 구독합니다.
 *
 * 고객 화면이나 점검자 화면에서 관리자의 시간표 변경을
 * 새로고침 없이 반영할 때 사용할 수 있습니다.
 */
export function subscribeBranchSettings(
  callback: (
    settings: BranchSettings
  ) => void
): () => void {
  const branchId = getBranchIdFromUrl();
  const defaults =
    defaultBranchSettings();

  if (!branchId) {
    callback(defaults);
    return () => {};
  }

  const ref =
    branchSettingsDoc("branch");

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(defaults);

        setDoc(
          ref,
          defaults,
          {
            merge: true,
          }
        ).catch((error) =>
          console.error(
            "기본 지점 설정 등록 실패:",
            error
          )
        );

        return;
      }

      callback(
        parseBranchSettings(
          snap.data()
        )
      );
    },
    (error) => {
      console.error(
        "subscribeBranchSettings error:",
        error
      );

      callback(defaults);
    }
  );
}

/**
 * 관리자 화면에서 지점 설정을 저장합니다.
 *
 * 민원 설정과 점검 시간표를 같은 branch 설정 문서에 저장합니다.
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

  const inspectionTimeSlots =
    normalizeInspectionTimeSlots(
      settings.inspectionTimeSlots ?? []
    ).map((slot) => ({
      id: slot.id,
      title: slot.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      order: slot.order,
    }));

  await setDoc(
    branchSettingsDoc("branch"),
    {
      complaintUrl:
        settings.complaintUrl.trim(),

      complaintWebhookUrl:
        settings.complaintWebhookUrl.trim(),

      inspectionTimeSlots,
    },
    {
      merge: true,
    }
  );
}