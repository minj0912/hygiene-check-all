import React, { useState } from "react";
import { verifyPassword } from "@/lib/utils";
import { AppMode } from "@/types";

interface ModeEntryProps {
  mode: "inspector" | "admin";
  onSuccess: (mode: AppMode) => void;
  label: string;
}

export function ModeEntry({ mode, onSuccess, label }: ModeEntryProps) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (await verifyPassword(pw, mode)) {
        setError(false);
        setPw("");
        setOpen(false);
        onSuccess(mode);
      } else {
        setError(true);
      }
    } catch (error) {
      console.error(error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors"
      >
        {label}
      </button>
    );
  }

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
            onClick={() => { setOpen(false); setPw(""); setError(false); }}
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
