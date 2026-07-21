import React, { useEffect, useState } from "react";
import { CheckCircle, ArrowLeft, ClipboardCheck, Circle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DEFAULT_RESTROOMS, DEFAULT_INSPECTION_ITEMS } from "@/data/restrooms";
import { submitInspection, subscribeRestrooms, subscribeInspectionItems } from "@/lib/firestore";
import { Restroom, InspectionItem, ItemResult } from "@/types";

interface InspectorModeProps {
  onBack: () => void;
}

export function InspectorMode({ onBack }: InspectorModeProps) {
  const [restrooms, setRestrooms] = useState<Restroom[]>(DEFAULT_RESTROOMS);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(DEFAULT_INSPECTION_ITEMS);
  const [selectedId, setSelectedId] = useState(DEFAULT_RESTROOMS[0].id);
  const [inspectorName, setInspectorName] = useState("");
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const u1 = subscribeRestrooms(setRestrooms);
    const u2 = subscribeInspectionItems(setInspectionItems);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    setResults({});
  }, [selectedId]);

  const selectedRestroom = restrooms.find((r) => r.id === selectedId) ?? restrooms[0];

  const setResult = (itemId: string, val: ItemResult) => {
    setResults((prev) => ({ ...prev, [itemId]: val }));
  };

  const allChecked = inspectionItems.every((item) => results[item.id]);
  const checkedCount = Object.keys(results).length;

  const handleSubmit = async () => {
    if (!inspectorName.trim()) { setError("점검자 이름을 입력해주세요"); return; }
    if (!allChecked) { setError(`모든 항목(${inspectionItems.length}개)을 선택해주세요`); return; }
    setError("");
    setLoading(true);
    try {
      await submitInspection({
        restroomId: selectedRestroom.id,
        restroomName: selectedRestroom.name,
        floor: selectedRestroom.floor,
        inspectorName: inspectorName.trim(),
        items: results,
      });
      setSuccess(true);
      setResults({});
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      setError("저장 중 오류가 발생했습니다. Firebase 설정을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const setAllO = () => {
    const all: Record<string, ItemResult> = {};
    inspectionItems.forEach((item) => { all[item.id] = "O"; });
    setResults(all);
  };

  return (
    <Layout>
      <div className="py-2 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">점검자 모드</h1>
            <p className="text-xs text-slate-400">항목별 O/X를 선택 후 완료하세요</p>
          </div>
        </div>

        {/* 화장실 + 이름 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">화장실 선택</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {restrooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">점검자 이름</label>
            <input
              value={inspectorName}
              onChange={(e) => { setInspectorName(e.target.value); setError(""); }}
              className={`w-full border rounded-xl px-4 py-3 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error && !inspectorName.trim() ? "border-red-400" : "border-slate-200"}`}
              placeholder="이름을 입력하세요"
            />
          </div>
        </div>

        {/* 항목별 O/X */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700">점검 항목</h2>
              <p className="text-xs text-slate-400 mt-0.5">{checkedCount} / {inspectionItems.length} 완료</p>
            </div>
            <button
              onClick={setAllO}
              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-semibold hover:bg-green-100 transition-colors"
            >
              전체 O
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${inspectionItems.length > 0 ? (checkedCount / inspectionItems.length) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {inspectionItems.map((item) => {
              const result = results[item.id];
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    result === "O" ? "bg-green-50 border-green-200" :
                    result === "X" ? "bg-red-50 border-red-200" :
                    "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result ? (
                      <CheckCircle size={16} className={result === "O" ? "text-green-500" : "text-red-400"} />
                    ) : (
                      <Circle size={16} className="text-slate-300" />
                    )}
                    <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResult(item.id, "O")}
                      className={`w-10 h-9 rounded-lg font-bold text-sm transition-all ${
                        result === "O"
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-500 hover:border-green-400 hover:text-green-600"
                      }`}
                    >
                      O
                    </button>
                    <button
                      onClick={() => setResult(item.id, "X")}
                      className={`w-10 h-9 rounded-lg font-bold text-sm transition-all ${
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
          <p className="text-red-500 text-sm text-center font-medium">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || success}
          className={`w-full py-4 rounded-2xl text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            success
              ? "bg-green-500 text-white"
              : allChecked && inspectorName.trim()
              ? "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          } disabled:opacity-70`}
        >
          {loading ? "저장 중..." : success ? (
            <><CheckCircle size={20} /> 점검 완료 저장됨!</>
          ) : (
            <><ClipboardCheck size={20} /> 점검 완료 ({checkedCount}/{inspectionItems.length})</>
          )}
        </button>
      </div>
    </Layout>
  );
}
