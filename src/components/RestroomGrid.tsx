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
import { Restroom, Inspection, InspectionItem, ItemResult } from "@/types";
import { subscribeInspectionsByDate } from "@/lib/firestore";
import { toDate } from "@/lib/utils";
import { DEFAULT_INSPECTION_ITEMS } from "@/data/restrooms";

type Language = "ko" | "en";

interface RestroomGridProps {
  restroom: Restroom;
  inspectionItems: InspectionItem[];
  language?: Language;
  onComplaintClick: () => void;
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
  if (id === "towel" || label.includes("페이퍼타올") || label.includes("종이타올")) return "Paper Towel";
  if (id === "soap" || label.includes("비누")) return "Soap";
  if (id === "floor" || label.includes("바닥") || label.includes("벽")) return "Floor / Wall";
  if (id === "vent" || label.includes("환기") || label.includes("환풍")) return "Ventilation";
  if (id === "notices" || label.includes("부착물") || label.includes("안내문")) return "Notices";

  return item.label;
}

function getItemIcon(item: InspectionItem) {
  const id = item.id?.toLowerCase?.() ?? "";
  const label = normalizeLabel(item.label ?? "");

  if (id === "toilet" || label.includes("좌변기")) return <Toilet size={26} />;
  if (id === "urinal" || label.includes("소변기")) return <PersonStanding size={26} />;
  if (id === "paper" || label.includes("휴지")) return <ScrollText size={26} />;
  if (id === "bin" || label.includes("휴지통")) return <Trash2 size={26} />;
  if (id === "sink" || label.includes("세면대")) return <Hand size={26} />;
  if (id === "mirror" || label.includes("거울")) return <ScanFace size={26} />;
  if (id === "towel" || label.includes("페이퍼타올") || label.includes("종이타올")) return <FileText size={26} />;
  if (id === "soap" || label.includes("비누")) return <FlaskConical size={26} />;
  if (id === "floor" || label.includes("바닥") || label.includes("벽")) return <LayoutGrid size={26} />;
  if (id === "vent" || label.includes("환기") || label.includes("환풍")) return <Wind size={26} />;
  if (id === "notices" || label.includes("부착물") || label.includes("안내문")) return <Pin size={26} />;

  return <Pin size={26} />;
}

function getDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLatestInspectionByPeriod(
  inspections: Inspection[],
  restroomId: string,
  period: "오전" | "오후"
): Inspection | null {
  const filtered = inspections.filter((inspection) => {
    const p = String(inspection.period ?? "").trim();
    return inspection.restroomId === restroomId && p === period;
  });

  if (filtered.length === 0) return null;

  return filtered.reduce((latest, current) => {
    const latestDate = toDate(latest.checkedAt);
    const currentDate = toDate(current.checkedAt);

    if (!latestDate) return current;
    if (!currentDate) return latest;

    return currentDate > latestDate ? current : latest;
  });
}

function getLatestInspection(
  inspections: Inspection[],
  restroomId: string
): Inspection | null {
  const filtered = inspections.filter(
    (inspection) => inspection.restroomId === restroomId
  );

  if (filtered.length === 0) return null;

  return filtered.reduce((latest, current) => {
    const latestDate = toDate(latest.checkedAt);
    const currentDate = toDate(current.checkedAt);

    if (!latestDate) return current;
    if (!currentDate) return latest;

    return currentDate > latestDate ? current : latest;
  });
}

function getItemResultFromInspection(
  inspection: Inspection | null,
  itemId: string,
  expectedPeriod: "오전" | "오후"
): ItemResult | null {
  if (!inspection) return null;

  const period = String(inspection.period ?? "").trim();
  if (period !== expectedPeriod) return null;

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
      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${stateClass}`}
    >
      <span>{label}</span>
      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
    </div>
  );
}

function InspectionStatusBanner({
  amInspection,
  pmInspection,
  latestInspection,
  language = "ko",
}: {
  amInspection: Inspection | null;
  pmInspection: Inspection | null;
  latestInspection: Inspection | null;
  language?: Language;
}) {
  if (!amInspection && !pmInspection) {
    return (
      <div className="bg-slate-100 rounded-xl px-4 py-2.5 text-center">
        <span className="text-sm text-slate-400">
          {language === "ko" ? "오늘 점검 내역 없음" : "No inspection record for today"}
        </span>
      </div>
    );
  }

  const latestDate = latestInspection ? toDate(latestInspection.checkedAt) : null;
  const hour = latestDate ? latestDate.getHours() : null;
  const minute = latestDate ? String(latestDate.getMinutes()).padStart(2, "0") : null;

  const amDone = !!amInspection;
  const pmDone = !!pmInspection;

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-green-700">
          {language === "ko" ? "오늘 점검 현황" : "Today's Inspection Status"}
        </span>
        {latestDate && (
          <span className="text-xs text-green-600">
            {language === "ko"
              ? `최종 점검 ${hour}:${minute}`
              : `Last updated ${hour}:${minute}`}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <span
          className={`text-xs px-2 py-1 rounded-full font-bold ${
            amDone
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {language === "ko" ? "오전" : "AM"}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded-full font-bold ${
            pmDone
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          {language === "ko" ? "오후" : "PM"}
        </span>
      </div>
    </div>
  );
}

export function RestroomGrid({
  restroom,
  inspectionItems,
  language = "ko",
  onComplaintClick,
}: RestroomGridProps) {
  const [todayInspections, setTodayInspections] = useState<Inspection[] | undefined>(undefined);
  const [dayKey, setDayKey] = useState(() => getDayKey(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextKey = getDayKey(new Date());
      setDayKey((prev) => (prev === nextKey ? prev : nextKey));
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTodayInspections(undefined);

    if (!restroom?.id) {
      setTodayInspections([]);
      return;
    }

    const unsub = subscribeInspectionsByDate(new Date(), (inspections) => {
      setTodayInspections(inspections);
    });

    return () => unsub();
  }, [restroom?.id, dayKey]);

  const itemsToShow =
    inspectionItems.length > 0 ? inspectionItems : DEFAULT_INSPECTION_ITEMS;

  const allInspections = todayInspections ?? [];

  const amInspection = useMemo(
    () => getLatestInspectionByPeriod(allInspections, restroom.id, "오전"),
    [allInspections, restroom.id]
  );

  const pmInspection = useMemo(
    () => getLatestInspectionByPeriod(allInspections, restroom.id, "오후"),
    [allInspections, restroom.id]
  );

  const latestInspection = useMemo(
    () => getLatestInspection(allInspections, restroom.id),
    [allInspections, restroom.id]
  );

  return (
    <div className="space-y-3">
      <InspectionStatusBanner
        amInspection={amInspection}
        pmInspection={pmInspection}
        latestInspection={latestInspection}
        language={language}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {itemsToShow.map((item) => {
          const icon = getItemIcon(item);

          const amResult = getItemResultFromInspection(amInspection, item.id, "오전");
          const pmResult = getItemResultFromInspection(pmInspection, item.id, "오후");
          const cardResult = pmResult !== null ? pmResult : amResult;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col items-center gap-2 text-center ${
                cardResult === "O"
                  ? "border-green-200"
                  : cardResult === "X"
                  ? "border-red-200"
                  : "border-slate-100"
              }`}
            >
              <div
                className={
                  cardResult === "O"
                    ? "text-green-500"
                    : cardResult === "X"
                    ? "text-red-400"
                    : "text-blue-400"
                }
              >
                {icon}
              </div>

              <span className="text-sm font-semibold text-slate-800">
                {language === "ko" ? item.label : getEnglishLabel(item)}
              </span>

              <div className="w-full grid grid-cols-2 gap-2 mt-1">
                <StatusDot
                  label={language === "ko" ? "오전" : "AM"}
                  result={amResult}
                />
                <StatusDot
                  label={language === "ko" ? "오후" : "PM"}
                  result={pmResult}
                />
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
            {language === "ko" ? "불편접수" : "Report Issue"}
          </span>
          <span className="text-xs text-orange-400 px-2.5 py-0.5">
            {language === "ko" ? "신고하기" : "Submit"}
          </span>
        </button>
      </div>
    </div>
  );
}