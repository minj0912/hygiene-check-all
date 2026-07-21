import React, { useEffect, useMemo, useState } from "react";
import {
  Toilet,
  ScrollText,
  Trash2,
  ScanFace,
  FileText,
  FlaskConical,
  LayoutGrid,
  Wind,
  Pin,
  AlertCircle,
  PersonStanding,
  Hand,
} from "lucide-react";
import {
  Restroom,
  Inspection,
  InspectionItem,
  ItemResult,
  InspectionTimeSlot,
} from "@/types";
import {
  subscribeBranchSettings,
  subscribeInspectionsByDate,
} from "@/lib/firestore";
import {
  sortInspectionTimeSlots,
  toDate,
} from "@/lib/utils";
import { DEFAULT_INSPECTION_ITEMS } from "@/data/restrooms";

type Language = "ko" | "en";

interface RestroomGridProps {
  restroom: Restroom;
  inspectionItems: InspectionItem[];
  language?: Language;
  onComplaintClick: () => void;
}

interface InspectionStatusEntry {
  key: string;
  label: string;
  inspection: Inspection | null;
}

function normalizeLabel(label: string) {
  return label.replace(/\s+/g, "").toLowerCase();
}

function getEnglishLabel(item: InspectionItem) {
  const id = item.id?.toLowerCase?.() ?? "";
  const label = normalizeLabel(item.label ?? "");

  if (id === "bin" || label.includes("휴지통")) return "Trash Bin";
  if (id === "paper" || label.includes("휴지")) return "Toilet Paper";

  if (id === "toilet" || label.includes("좌변기")) return "Toilet";
  if (id === "urinal" || label.includes("소변기")) return "Urinal";
  if (id === "sink" || label.includes("세면대")) return "Sink";
  if (id === "mirror" || label.includes("거울")) return "Mirror";
  if (
    id === "towel" ||
    label.includes("페이퍼타올") ||
    label.includes("종이타올")
  ) {
    return "Paper Towel";
  }
  if (id === "soap" || label.includes("비누")) return "Soap";
  if (id === "floor" || label.includes("바닥") || label.includes("벽")) {
    return "Floor / Wall";
  }
  if (
    id === "vent" ||
    label.includes("환기") ||
    label.includes("환풍")
  ) {
    return "Ventilation";
  }
  if (
    id === "notices" ||
    label.includes("부착물") ||
    label.includes("안내문")
  ) {
    return "Notices";
  }

  return item.label;
}

function getItemIcon(item: InspectionItem) {
  const id = item.id?.toLowerCase?.() ?? "";
  const label = normalizeLabel(item.label ?? "");

  if (id === "toilet" || label.includes("좌변기")) {
    return <Toilet size={26} />;
  }
  if (id === "urinal" || label.includes("소변기")) {
    return <PersonStanding size={26} />;
  }
  if (id === "paper" || label.includes("휴지")) {
    return <ScrollText size={26} />;
  }
  if (id === "bin" || label.includes("휴지통")) {
    return <Trash2 size={26} />;
  }
  if (id === "sink" || label.includes("세면대")) {
    return <Hand size={26} />;
  }
  if (id === "mirror" || label.includes("거울")) {
    return <ScanFace size={26} />;
  }
  if (
    id === "towel" ||
    label.includes("페이퍼타올") ||
    label.includes("종이타올")
  ) {
    return <FileText size={26} />;
  }
  if (id === "soap" || label.includes("비누")) {
    return <FlaskConical size={26} />;
  }
  if (id === "floor" || label.includes("바닥") || label.includes("벽")) {
    return <LayoutGrid size={26} />;
  }
  if (
    id === "vent" ||
    label.includes("환기") ||
    label.includes("환풍")
  ) {
    return <Wind size={26} />;
  }
  if (
    id === "notices" ||
    label.includes("부착물") ||
    label.includes("안내문")
  ) {
    return <Pin size={26} />;
  }

  return <Pin size={26} />;
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLatestInspectionFromList(
  inspections: Inspection[]
): Inspection | null {
  if (inspections.length === 0) {
    return null;
  }

  return inspections.reduce((latest, current) => {
    const latestDate = toDate(latest.checkedAt);
    const currentDate = toDate(current.checkedAt);

    if (!latestDate) return current;
    if (!currentDate) return latest;

    return currentDate > latestDate ? current : latest;
  });
}

function getLatestInspectionByLegacyPeriod(
  inspections: Inspection[],
  restroomId: string,
  period: "오전" | "오후"
): Inspection | null {
  const filtered = inspections.filter((inspection) => {
    const savedPeriod = String(inspection.period ?? "").trim();

    return (
      inspection.restroomId === restroomId &&
      savedPeriod === period
    );
  });

  return getLatestInspectionFromList(filtered);
}

/**
 * 사용자 지정 점검 시간대의 최신 기록을 찾습니다.
 *
 * 신규 기록은 timeSlotId로 정확히 구분합니다.
 * 초기 적용 과정에서 ID 없이 제목만 저장된 기록이 있을 수 있어,
 * timeSlotId가 없는 기록에 한해서 제목도 보조적으로 비교합니다.
 */
function getLatestInspectionByTimeSlot(
  inspections: Inspection[],
  restroomId: string,
  slot: InspectionTimeSlot
): Inspection | null {
  const filtered = inspections.filter((inspection) => {
    if (inspection.restroomId !== restroomId) {
      return false;
    }

    if (inspection.timeSlotId) {
      return inspection.timeSlotId === slot.id;
    }

    const savedTitle = String(
      inspection.timeSlotTitle ?? inspection.period ?? ""
    ).trim();

    return savedTitle === slot.title.trim();
  });

  return getLatestInspectionFromList(filtered);
}

function getItemResultFromInspection(
  inspection: Inspection | null,
  itemId: string
): ItemResult | null {
  if (!inspection) {
    return null;
  }

  const value = inspection.items?.[itemId];

  return value === "O" || value === "X" ? value : null;
}

function StatusDot({
  label,
  result,
}: {
  label: string;
  result: ItemResult | null;
}) {
  const stateClass =
    result === "O"
      ? "border-green-200 bg-green-50 text-green-700"
      : result === "X"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-slate-200 bg-slate-50 text-slate-400";

  const dotClass =
    result === "O"
      ? "bg-green-500"
      : result === "X"
      ? "bg-red-500"
      : "bg-slate-300";

  return (
    <div
      className={`min-w-0 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${stateClass}`}
      title={label}
    >
      <span className="truncate">{label}</span>
      <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${dotClass}`} />
    </div>
  );
}

function InspectionStatusBanner({
  entries,
  latestInspection,
  loading,
  language = "ko",
}: {
  entries: InspectionStatusEntry[];
  latestInspection: Inspection | null;
  loading: boolean;
  language?: Language;
}) {
  if (loading) {
    return (
      <div className="bg-slate-100 rounded-xl px-4 py-2.5 text-center">
        <span className="text-sm text-slate-400">
          {language === "ko"
            ? "오늘 점검 현황을 불러오는 중..."
            : "Loading today's inspection status..."}
        </span>
      </div>
    );
  }

  const latestDate = latestInspection
    ? toDate(latestInspection.checkedAt)
    : null;

  const hour = latestDate
    ? String(latestDate.getHours()).padStart(2, "0")
    : null;

  const minute = latestDate
    ? String(latestDate.getMinutes()).padStart(2, "0")
    : null;

  const completedCount = entries.filter(
    (entry) => Boolean(entry.inspection)
  ).length;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        completedCount > 0
          ? "bg-green-50 border-green-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span
            className={`text-sm font-semibold ${
              completedCount > 0
                ? "text-green-700"
                : "text-slate-600"
            }`}
          >
            {language === "ko"
              ? "오늘 점검 현황"
              : "Today's Inspection Status"}
          </span>

          {latestDate ? (
            <span className="text-xs text-green-600">
              {language === "ko"
                ? `최종 점검 ${hour}:${minute}`
                : `Last updated ${hour}:${minute}`}
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              {language === "ko"
                ? "아직 완료된 점검이 없습니다"
                : "No completed inspections yet"}
            </span>
          )}
        </div>

        {entries.length > 0 && (
          <span
            className={`shrink-0 text-xs font-bold ${
              completedCount > 0
                ? "text-green-700"
                : "text-slate-400"
            }`}
          >
            {completedCount}/{entries.length}
          </span>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {entries.map((entry) => {
            const completed = Boolean(entry.inspection);

            return (
              <span
                key={entry.key}
                className={`max-w-full text-xs px-2.5 py-1 rounded-full font-bold truncate ${
                  completed
                    ? "bg-green-100 text-green-700"
                    : "bg-white border border-slate-200 text-slate-400"
                }`}
                title={entry.label}
              >
                {entry.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RestroomGrid({
  restroom,
  inspectionItems,
  language = "ko",
  onComplaintClick,
}: RestroomGridProps) {
  const [todayInspections, setTodayInspections] =
    useState<Inspection[] | undefined>(undefined);
  const [inspectionTimeSlots, setInspectionTimeSlots] =
    useState<InspectionTimeSlot[] | undefined>(undefined);
  const [dayKey, setDayKey] = useState(() => getDayKey(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextKey = getDayKey(new Date());

      setDayKey((previous) =>
        previous === nextKey ? previous : nextKey
      );
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBranchSettings((settings) => {
      setInspectionTimeSlots(settings.inspectionTimeSlots ?? []);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setTodayInspections(undefined);

    if (!restroom?.id) {
      setTodayInspections([]);
      return;
    }

    const unsubscribe = subscribeInspectionsByDate(
      new Date(),
      setTodayInspections
    );

    return () => unsubscribe();
  }, [restroom?.id, dayKey]);

  const itemsToShow =
    inspectionItems.length > 0
      ? inspectionItems
      : DEFAULT_INSPECTION_ITEMS;

  const allInspections = todayInspections ?? [];

  const sortedTimeSlots = useMemo(
    () => sortInspectionTimeSlots(inspectionTimeSlots ?? []),
    [inspectionTimeSlots]
  );

  const hasCustomTimeSlots = sortedTimeSlots.length > 0;

  const statusEntries = useMemo<InspectionStatusEntry[]>(() => {
    if (!restroom?.id) {
      return [];
    }

    if (hasCustomTimeSlots) {
      return sortedTimeSlots.map((slot) => ({
        key: slot.id,
        label: slot.title,
        inspection: getLatestInspectionByTimeSlot(
          allInspections,
          restroom.id,
          slot
        ),
      }));
    }

    return [
      {
        key: "legacy_am",
        label: language === "ko" ? "오전" : "AM",
        inspection: getLatestInspectionByLegacyPeriod(
          allInspections,
          restroom.id,
          "오전"
        ),
      },
      {
        key: "legacy_pm",
        label: language === "ko" ? "오후" : "PM",
        inspection: getLatestInspectionByLegacyPeriod(
          allInspections,
          restroom.id,
          "오후"
        ),
      },
    ];
  }, [
    allInspections,
    restroom?.id,
    hasCustomTimeSlots,
    sortedTimeSlots,
    language,
  ]);

  const latestVisibleInspection = useMemo(
    () =>
      getLatestInspectionFromList(
        statusEntries.flatMap((entry) =>
          entry.inspection ? [entry.inspection] : []
        )
      ),
    [statusEntries]
  );

  const statusGridClass =
    statusEntries.length <= 1
      ? "grid-cols-1"
      : "grid-cols-2";

  const isLoading =
    todayInspections === undefined ||
    inspectionTimeSlots === undefined;

  return (
    <div className="space-y-3">
      <InspectionStatusBanner
        entries={statusEntries}
        latestInspection={latestVisibleInspection}
        loading={isLoading}
        language={language}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {itemsToShow.map((item) => {
          const icon = getItemIcon(item);

          const itemResults = statusEntries.map((entry) => ({
            key: entry.key,
            label: entry.label,
            result: getItemResultFromInspection(
              entry.inspection,
              item.id
            ),
          }));

          const latestItemResult =
            getItemResultFromInspection(
              latestVisibleInspection,
              item.id
            );

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center gap-2 text-center ${
                latestItemResult === "O"
                  ? "border-green-200"
                  : latestItemResult === "X"
                  ? "border-red-200"
                  : "border-slate-100"
              }`}
            >
              <div
                className={
                  latestItemResult === "O"
                    ? "text-green-500"
                    : latestItemResult === "X"
                    ? "text-red-400"
                    : "text-blue-400"
                }
              >
                {icon}
              </div>

              <span className="text-sm font-semibold text-slate-800">
                {language === "ko"
                  ? item.label
                  : getEnglishLabel(item)}
              </span>

              <div
                className={`w-full grid ${statusGridClass} gap-2 mt-1`}
              >
                {itemResults.map((entry) => (
                  <StatusDot
                    key={entry.key}
                    label={entry.label}
                    result={entry.result}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <button
          onClick={onComplaintClick}
          className="bg-white rounded-2xl border border-orange-200 shadow-sm p-4 flex flex-col items-center gap-2 text-center hover:shadow-md hover:bg-orange-50 transition-all cursor-pointer"
        >
          <div className="text-orange-500">
            <AlertCircle size={26} />
          </div>
          <span className="text-sm font-semibold text-slate-800">
            {language === "ko"
              ? "불편접수"
              : "Report Issue"}
          </span>
          <span className="text-xs text-orange-400 px-2.5 py-0.5">
            {language === "ko"
              ? "신고하기"
              : "Submit"}
          </span>
        </button>
      </div>
    </div>
  );
}