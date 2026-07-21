import React from "react";
import { Restroom } from "@/types";

interface RestroomSelectorProps {
  restrooms: Restroom[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function RestroomSelector({ restrooms, selectedId, onChange }: RestroomSelectorProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        화장실 선택
      </label>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {restrooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.locationLabel})
          </option>
        ))}
      </select>
    </div>
  );
}
