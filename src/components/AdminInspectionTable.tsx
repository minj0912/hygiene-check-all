import React from "react";
import { Restroom, Inspection } from "@/types";
import { FLOOR_ORDER } from "@/data/restrooms";
import { formatDateTime, toDate } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";

interface AdminInspectionTableProps {
  restrooms: Restroom[];
  inspectionMap: Record<string, Inspection>;
}

export function AdminInspectionTable({ restrooms, inspectionMap }: AdminInspectionTableProps) {
  const grouped = FLOOR_ORDER.map((floor) => ({
    floor,
    rooms: restrooms.filter((r) => r.floor === floor),
  }));

  return (
    <div className="space-y-4">
      {grouped.map(({ floor, rooms }) => (
        <div key={floor} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-700 px-4 py-2.5">
            <span className="text-white font-bold text-sm">{floor} 층</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">화장실</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">최근 점검</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">구분</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">점검자</th>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const insp = inspectionMap[room.id];
                  return (
                    <tr key={room.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{room.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {insp ? formatDateTime(insp.checkedAt) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {insp ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${insp.period === "오전" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                            {insp.period}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{insp ? insp.inspectorName : "-"}</td>
                      <td className="px-4 py-3">
                        {insp ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs">
                            <CheckCircle size={14} />
                            완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-xs">
                            <XCircle size={14} />
                            미점검
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
