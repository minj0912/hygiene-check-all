import React, { useState } from "react";
import { Home } from "@/pages/Home";
import { InspectorMode } from "@/pages/InspectorMode";
import { AdminMode } from "@/pages/AdminMode";
import { AppMode } from "@/types";
import { getInitialModeFromUrl } from "@/lib/branch";
import { verifyPassword } from "@/lib/utils";

function DirectModePasswordGate({
  mode,
  onCancel,
  onSuccess,
}: {
  mode: "inspector" | "admin";
  onCancel: () => void;
  onSuccess: (mode: AppMode) => void;
}) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const label = mode === "admin" ? "관리자" : "점검자";

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (await verifyPassword(pw, mode)) {
        setError(false);
        setPw("");
        onSuccess(mode);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">{label}</h2>
        <p className="text-sm text-slate-500 mb-4">비밀번호를 입력하세요</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
          className={`w-full border rounded-xl px-4 py-3 text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 ${error ? "border-red-400" : "border-slate-200"}`}
          placeholder="● ● ● ●"
          maxLength={6}
          autoFocus
        />
        {error && (
          <p className="text-red-500 text-sm text-center mb-3">비밀번호가 틀렸습니다</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-200 rounded-xl py-2.5 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? "확인 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const initialMode = getInitialModeFromUrl();
  const [mode, setMode] = useState<AppMode>("home");
  const [pendingMode, setPendingMode] = useState<"inspector" | "admin" | null>(
    initialMode === "home" ? null : initialMode
  );

  const handleModeChange = (m: AppMode) => setMode(m);
  const goHome = () => setMode("home");

  const closePendingMode = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("mode");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
    setPendingMode(null);
  };

  const approvePendingMode = (m: AppMode) => {
    setPendingMode(null);
    setMode(m);
  };

  if (mode === "inspector") return <InspectorMode onBack={goHome} />;
  if (mode === "admin") return <AdminMode onBack={goHome} />;

  return (
    <>
      <Home onModeChange={handleModeChange} />
      {pendingMode && (
        <DirectModePasswordGate
          mode={pendingMode}
          onCancel={closePendingMode}
          onSuccess={approvePendingMode}
        />
      )}
    </>
  );
}
