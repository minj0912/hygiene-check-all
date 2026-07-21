import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ArrowLeft,
  ClipboardCheck,
  Circle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  DEFAULT_RESTROOMS,
  DEFAULT_INSPECTION_ITEMS,
} from "@/data/restrooms";
import {
  submitInspection,
  subscribeRestrooms,
  subscribeInspectionItems,
  subscribeInspectionsByDate,
  subscribeBranchSettings,
} from "@/lib/firestore";
import {
  Restroom,
  InspectionItem,
  ItemResult,
  Inspection,
  InspectionTimeSlot,
} from "@/types";
import {
  getPeriod,
  getActiveInspectionTimeSlot,
  getNextInspectionTimeSlot,
  sortInspectionTimeSlots,
} from "@/lib/utils";

interface InspectorModeProps {
  onBack: () => void;
}

function getLockedRestroomIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("restroom") ?? "";
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 오늘 특정 화장실의 현재 점검 시간대가 이미 완료되었는지 확인합니다.
 *
 * 사용자 지정 시간대는 timeSlotId를 우선 비교합니다.
 * 초기 적용 과정에서 timeSlotId 없이 제목만 저장된 기록이 있을 수 있어
 * period/timeSlotTitle도 보조적으로 확인합니다.
 */
function hasInspectionForCurrentSlot(
  inspections: Inspection[],
  restroomId: string,
  activeTimeSlot: InspectionTimeSlot | null,
  fallbackPeriod: "오전" | "오후"
): boolean {
  return inspections.some((inspection) => {
    if (inspection.restroomId !== restroomId) {
      return false;
    }

    if (activeTimeSlot) {
      if (inspection.timeSlotId) {
        return inspection.timeSlotId === activeTimeSlot.id;
      }

      const savedTitle = String(
        inspection.timeSlotTitle ?? inspection.period ?? ""
      ).trim();

      return savedTitle === activeTimeSlot.title.trim();
    }

    return String(inspection.period).trim() === fallbackPeriod;
  });
}

export function InspectorMode({ onBack }: InspectorModeProps) {
  const lockedRestroomId = useMemo(() => getLockedRestroomIdFromUrl(), []);
  const isQrLocked = Boolean(lockedRestroomId);

  const [restrooms, setRestrooms] = useState<Restroom[]>(DEFAULT_RESTROOMS);
  const [inspectionItems, setInspectionItems] =
    useState<InspectionItem[]>(DEFAULT_INSPECTION_ITEMS);
  const [selectedId, setSelectedId] = useState(
    lockedRestroomId || DEFAULT_RESTROOMS[0]?.id || ""
  );
  const [inspectorName, setInspectorName] = useState("");
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [todayInspections, setTodayInspections] = useState<Inspection[]>([]);
  const [inspectionTimeSlots, setInspectionTimeSlots] = useState<
    InspectionTimeSlot[]
  >([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  const todayKey = formatDateLocal(now);
  const fallbackPeriod = getPeriod(now);

  const sortedTimeSlots = useMemo(
    () => sortInspectionTimeSlots(inspectionTimeSlots),
    [inspectionTimeSlots]
  );

  const hasCustomTimeSlots = sortedTimeSlots.length > 0;

  const activeTimeSlot = useMemo(
    () =>
      hasCustomTimeSlots
        ? getActiveInspectionTimeSlot(sortedTimeSlots, now)
        : null,
    [hasCustomTimeSlots, sortedTimeSlots, now]
  );

  const nextTimeSlot = useMemo(
    () =>
      hasCustomTimeSlots
        ? getNextInspectionTimeSlot(sortedTimeSlots, now)
        : null,
    [hasCustomTimeSlots, sortedTimeSlots, now]
  );

  const isInspectionOpen =
    settingsLoaded && (!hasCustomTimeSlots || Boolean(activeTimeSlot));

  const currentSlotKey = hasCustomTimeSlots
    ? activeTimeSlot?.id ?? "closed"
    : fallbackPeriod;

  const currentDisplayTitle = activeTimeSlot?.title ?? fallbackPeriod;

  // 현재 시간과 점검 가능 시간대를 주기적으로 갱신합니다.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribeRestrooms = subscribeRestrooms(setRestrooms);
    const unsubscribeItems = subscribeInspectionItems(setInspectionItems);
    const unsubscribeSettings = subscribeBranchSettings((settings) => {
      setInspectionTimeSlots(settings.inspectionTimeSlots ?? []);
      setSettingsLoaded(true);
    });

    return () => {
      unsubscribeRestrooms();
      unsubscribeItems();
      unsubscribeSettings();
    };
  }, []);

  // QR로 들어온 경우 해당 화장실로 강제 고정합니다.
  useEffect(() => {
    if (!restrooms.length) return;

    if (lockedRestroomId) {
      const lockedRoomExists = restrooms.some(
        (restroom) => restroom.id === lockedRestroomId
      );

      if (lockedRoomExists && selectedId !== lockedRestroomId) {
        setSelectedId(lockedRestroomId);
      }

      return;
    }

    const selectedRoomExists = restrooms.some(
      (restroom) => restroom.id === selectedId
    );

    if (!selectedRoomExists) {
      setSelectedId(restrooms[0]?.id ?? "");
    }
  }, [restrooms, selectedId, lockedRestroomId]);

  // 날짜가 바뀌면 새 날짜의 점검 기록을 다시 구독합니다.
  useEffect(() => {
    const selectedDate = new Date(now);
    const unsubscribe = subscribeInspectionsByDate(
      selectedDate,
      setTodayInspections
    );

    return () => unsubscribe();
  }, [todayKey]);

  // 화장실이나 점검 시간대가 바뀌면 이전 선택값을 초기화합니다.
  useEffect(() => {
    setResults({});
    setError("");
    setSuccess(false);
  }, [selectedId, currentSlotKey]);

  const selectedRestroom =
    restrooms.find((restroom) => restroom.id === selectedId) ??
    restrooms.find((restroom) => restroom.id === lockedRestroomId) ??
    restrooms[0];

  const alreadyInspected = useMemo(() => {
    if (!selectedRestroom?.id || !isInspectionOpen) {
      return false;
    }

    return hasInspectionForCurrentSlot(
      todayInspections,
      selectedRestroom.id,
      activeTimeSlot,
      fallbackPeriod
    );
  }, [
    todayInspections,
    selectedRestroom,
    activeTimeSlot,
    fallbackPeriod,
    isInspectionOpen,
  ]);

  const controlsDisabled =
    !settingsLoaded ||
    !isInspectionOpen ||
    alreadyInspected ||
    loading ||
    success;

  const setResult = (itemId: string, value: ItemResult) => {
    if (controlsDisabled) return;

    setResults((previous) => ({
      ...previous,
      [itemId]: value,
    }));
    setError("");
  };

  const allChecked =
    inspectionItems.length > 0 &&
    inspectionItems.every((item) => Boolean(results[item.id]));

  const checkedCount = Object.keys(results).length;

  const handleSubmit = async () => {
    const submitTime = new Date();
    const latestActiveTimeSlot = hasCustomTimeSlots
      ? getActiveInspectionTimeSlot(sortedTimeSlots, submitTime)
      : null;
    const latestFallbackPeriod = getPeriod(submitTime);

    if (!selectedRestroom) {
      setError("점검할 화장실 정보를 불러오지 못했습니다.");
      return;
    }

    if (!settingsLoaded) {
      setError("점검 시간 설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    if (hasCustomTimeSlots && !latestActiveTimeSlot) {
      setNow(submitTime);
      setError("현재는 점검 가능한 시간이 아닙니다.");
      return;
    }

    if (!inspectorName.trim()) {
      setError("점검자 이름을 입력해주세요.");
      return;
    }

    if (!allChecked) {
      setError(`모든 항목(${inspectionItems.length}개)을 선택해주세요.`);
      return;
    }

    const duplicateExists = hasInspectionForCurrentSlot(
      todayInspections,
      selectedRestroom.id,
      latestActiveTimeSlot,
      latestFallbackPeriod
    );

    if (duplicateExists) {
      setNow(submitTime);
      setError(
        `이미 ${
          latestActiveTimeSlot?.title ?? latestFallbackPeriod
        } 점검이 완료된 화장실입니다.`
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      await submitInspection({
        restroomId: selectedRestroom.id,
        restroomName: selectedRestroom.name,
        floor: selectedRestroom.floor,
        inspectorName: inspectorName.trim(),
        items: results,
        timeSlot: latestActiveTimeSlot,
      });

      setNow(submitTime);
      setSuccess(true);
      setResults({});

      window.setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (submitError) {
      console.error(submitError);
      setError("저장 중 오류가 발생했습니다. Firebase 설정을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const setAllO = () => {
    if (controlsDisabled) return;

    const allResults: Record<string, ItemResult> = {};

    inspectionItems.forEach((item) => {
      allResults[item.id] = "O";
    });

    setResults(allResults);
    setError("");
  };

  const nextTimeMessage = nextTimeSlot
    ? `${nextTimeSlot.isTomorrow ? "내일 " : ""}${nextTimeSlot.slot.title} (${
        nextTimeSlot.slot.startTime
      } ~ ${nextTimeSlot.slot.endTime})`
    : "";

  return (
    <Layout>
      <div className="py-2 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>

          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">점검자 모드</h1>
            <p className="text-xs text-slate-400">
              항목별 O/X를 선택 후 완료하세요
            </p>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              !settingsLoaded
                ? "bg-slate-50 text-slate-500 border border-slate-200"
                : hasCustomTimeSlots && !activeTimeSlot
                ? "bg-red-50 text-red-600 border border-red-200"
                : activeTimeSlot
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : fallbackPeriod === "오전"
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-orange-50 text-orange-600 border border-orange-200"
            }`}
          >
            <Clock size={12} />
            <span>
              {!settingsLoaded
                ? "시간 확인 중"
                : hasCustomTimeSlots && !activeTimeSlot
                ? "점검 시간 외"
                : `현재 ${currentDisplayTitle}`}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          {isQrLocked ? (
            <>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle
                  size={16}
                  className="text-emerald-500 shrink-0"
                />
                <p className="text-sm text-emerald-700 font-medium">
                  현재 QR 코드로 접속한 화장실만 점검 가능합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  점검 화장실
                </label>
                <div className="w-full border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 text-base text-slate-800 font-medium">
                  {selectedRestroom
                    ? `${selectedRestroom.name}${
                        selectedRestroom.locationLabel
                          ? ` (${selectedRestroom.locationLabel})`
                          : ""
                      }`
                    : "화장실 정보를 불러오는 중..."}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                화장실 선택
              </label>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {restrooms.map((restroom) => (
                  <option key={restroom.id} value={restroom.id}>
                    {restroom.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!settingsLoaded ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Clock size={16} className="text-slate-400 shrink-0" />
              <p className="text-sm text-slate-600 font-medium">
                지점 점검 시간 설정을 불러오는 중입니다.
              </p>
            </div>
          ) : hasCustomTimeSlots && activeTimeSlot ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <Clock size={16} className="text-blue-500 shrink-0" />
              <div>
                <p className="text-sm text-blue-700 font-bold">
                  현재 {activeTimeSlot.title} 점검 시간입니다.
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  점검 가능 시간: {activeTimeSlot.startTime} ~{" "}
                  {activeTimeSlot.endTime}
                </p>
              </div>
            </div>
          ) : hasCustomTimeSlots ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-bold">
                  현재는 점검 가능한 시간이 아닙니다.
                </p>
                {nextTimeMessage && (
                  <p className="text-xs text-red-600 mt-0.5">
                    다음 점검: {nextTimeMessage}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {alreadyInspected && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <CheckCircle
                size={16}
                className="text-amber-500 shrink-0"
              />
              <p className="text-sm text-amber-700 font-medium">
                이 화장실은 {currentDisplayTitle} 점검이 이미 완료되었습니다.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              점검자 이름
            </label>
            <input
              value={inspectorName}
              onChange={(event) => {
                setInspectorName(event.target.value);
                setError("");
              }}
              disabled={!settingsLoaded || !isInspectionOpen}
              className={`w-full border rounded-xl px-4 py-3 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 ${
                error && !inspectorName.trim()
                  ? "border-red-400"
                  : "border-slate-200"
              }`}
              placeholder={
                isInspectionOpen
                  ? "이름을 입력하세요"
                  : "점검 가능 시간에 입력할 수 있습니다"
              }
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700">점검 항목</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {checkedCount} / {inspectionItems.length} 완료
              </p>
            </div>

            <button
              onClick={setAllO}
              disabled={controlsDisabled}
              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-semibold hover:bg-green-100 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
            >
              전체 O
            </button>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${
                  inspectionItems.length > 0
                    ? (checkedCount / inspectionItems.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="space-y-2">
            {inspectionItems.map((item) => {
              const result = results[item.id];

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    result === "O"
                      ? "bg-green-50 border-green-200"
                      : result === "X"
                      ? "bg-red-50 border-red-200"
                      : "bg-slate-50 border-slate-200"
                  } ${controlsDisabled ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {result ? (
                      <CheckCircle
                        size={16}
                        className={
                          result === "O"
                            ? "text-green-500"
                            : "text-red-400"
                        }
                      />
                    ) : (
                      <Circle size={16} className="text-slate-300" />
                    )}

                    <span className="text-sm font-semibold text-slate-800">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setResult(item.id, "O")}
                      disabled={controlsDisabled}
                      className={`w-10 h-9 rounded-lg font-bold text-sm transition-all disabled:cursor-not-allowed ${
                        result === "O"
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-500 hover:border-green-400 hover:text-green-600"
                      }`}
                    >
                      O
                    </button>

                    <button
                      onClick={() => setResult(item.id, "X")}
                      disabled={controlsDisabled}
                      className={`w-10 h-9 rounded-lg font-bold text-sm transition-all disabled:cursor-not-allowed ${
                        result === "X"
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-500"
                      }`}
                    >
                      X
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center font-medium">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            loading ||
            success ||
            alreadyInspected ||
            !selectedRestroom ||
            !isInspectionOpen ||
            !settingsLoaded
          }
          className={`w-full py-4 rounded-2xl text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            success
              ? "bg-green-500 text-white"
              : alreadyInspected ||
                !selectedRestroom ||
                !isInspectionOpen ||
                !settingsLoaded
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : allChecked && inspectorName.trim()
              ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          } disabled:opacity-70`}
        >
          {loading ? (
            "저장 중..."
          ) : success ? (
            <>
              <CheckCircle size={20} /> 점검 완료 저장됨!
            </>
          ) : alreadyInspected ? (
            <>
              <CheckCircle size={20} /> {currentDisplayTitle} 점검 완료됨
            </>
          ) : !settingsLoaded ? (
            <>
              <Clock size={20} /> 점검 시간 확인 중
            </>
          ) : !isInspectionOpen ? (
            <>
              <Clock size={20} /> 현재 점검 시간 아님
            </>
          ) : (
            <>
              <ClipboardCheck size={20} /> 점검 완료 ({checkedCount}/
              {inspectionItems.length})
            </>
          )}
        </button>
      </div>
    </Layout>
  );
}