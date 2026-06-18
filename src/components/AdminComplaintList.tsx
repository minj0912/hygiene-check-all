import React from "react";
import { Complaint } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle, Clock, Eye, CheckCheck } from "lucide-react";

interface AdminComplaintListProps {
  complaints: Complaint[];
  onMarkRead: (id: string) => Promise<void> | void;
  onMarkResolved: (id: string) => Promise<void> | void;
}

function safeFormatDateTime(value?: any) {
  if (!value) return "";
  return formatDateTime(value);
}

export function AdminComplaintList({
  complaints,
  onMarkRead,
  onMarkResolved,
}: AdminComplaintListProps) {
  if (complaints.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
        <p className="text-slate-400 text-sm">접수된 불편 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((item) => (
        <div
          key={item.id}
          className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
            !item.isRead ? "border-orange-300 bg-orange-50" : "border-slate-100"
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              {!item.isRead && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">
                  NEW
                </span>
              )}
              <span className="font-bold text-slate-800">{item.title}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {item.isResolved ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <CheckCircle size={13} />
                  처리완료
                </span>
              ) : item.isRead ? (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold">
                  <Eye size={13} />
                  읽음
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-semibold">
                  <Clock size={13} />
                  접수완료
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-500 mb-1">
            <span className="font-medium text-slate-600">위치:</span> {item.location}
          </p>

          <p className="text-sm text-slate-600 mb-3">{item.detail}</p>

          <div className="space-y-1 mb-3">
            <p className="text-xs text-slate-400">
              접수 : {safeFormatDateTime(item.createdAt)}
            </p>

            {item.isRead && item.readAt && (
              <p className="text-xs text-blue-600 font-medium">
                읽음 : {safeFormatDateTime(item.readAt)}
              </p>
            )}

            {item.isResolved && item.resolvedAt && (
              <p className="text-xs text-green-600 font-medium">
                처리완료 : {safeFormatDateTime(item.resolvedAt)}
              </p>
            )}
          </div>

          {!item.isResolved && (
            <div className="flex gap-2">
              {!item.isRead && item.id && (
                <button
                  onClick={() => onMarkRead(item.id!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                >
                  <Eye size={14} />
                  읽음
                </button>
              )}

              {item.isRead && item.id && (
                <button
                  onClick={() => onMarkResolved(item.id!)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                >
                  <CheckCheck size={14} />
                  처리완료
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}