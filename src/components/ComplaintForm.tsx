import React, { useState } from "react";
import { submitComplaint } from "@/lib/firestore";
import { Restroom } from "@/types";
import { X, CheckCircle } from "lucide-react";

type Language = "ko" | "en";

interface ComplaintFormProps {
  restroom: Restroom;
  onClose: () => void;
  language?: Language;
}

export function ComplaintForm({
  restroom,
  onClose,
  language = "ko",
}: ComplaintFormProps) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState(restroom.name);
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const text = {
    ko: {
      modalTitle: "불편접수",
      doneTitle: "접수 완료되었습니다!",
      doneDesc: "담당자가 확인 후 처리할 예정입니다.",
      titleLabel: "제목 *",
      titlePlaceholder: "예: 휴지가 없어요",
      locationLabel: "위치 *",
      locationPlaceholder: "예: 10층 여자화장실 1",
      detailLabel: "상세 내용 *",
      detailPlaceholder: "불편사항을 자세히 입력해주세요",
      cancel: "취소",
      submit: "접수하기",
      submitting: "접수 중...",
      titleError: "제목을 입력해주세요",
      locationError: "위치를 입력해주세요",
      detailError: "상세 내용을 입력해주세요",
    },
    en: {
      modalTitle: "Report Issue",
      doneTitle: "Your report has been submitted!",
      doneDesc: "The person in charge will review and handle it shortly.",
      titleLabel: "Title *",
      titlePlaceholder: "e.g. There is no toilet paper",
      locationLabel: "Location *",
      locationPlaceholder: "e.g. 10F Women's Restroom 1",
      detailLabel: "Details *",
      detailPlaceholder: "Please describe the issue in detail",
      cancel: "Cancel",
      submit: "Submit",
      submitting: "Submitting...",
      titleError: "Please enter a title",
      locationError: "Please enter a location",
      detailError: "Please enter the details",
    },
  }[language];

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = text.titleError;
    if (!location.trim()) e.location = text.locationError;
    if (!detail.trim()) e.detail = text.detailError;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      await submitComplaint({
        title: title.trim(),
        location: location.trim(),
        detail: detail.trim(),
        restroomId: restroom.id,
        restroomName: restroom.name,
      });

      setDone(true);

      setTimeout(() => {
        setTitle("");
        setDetail("");
        setDone(false);
        onClose();
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{text.modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="text-green-500" size={48} />
            <p className="text-lg font-semibold text-slate-800">{text.doneTitle}</p>
            <p className="text-sm text-slate-500">{text.doneDesc}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {text.titleLabel}
              </label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((p) => ({ ...p, title: "" }));
                }}
                className={`w-full border rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? "border-red-400" : "border-slate-200"
                }`}
                placeholder={text.titlePlaceholder}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {text.locationLabel}
              </label>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setErrors((p) => ({ ...p, location: "" }));
                }}
                className={`w-full border rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.location ? "border-red-400" : "border-slate-200"
                }`}
                placeholder={text.locationPlaceholder}
              />
              {errors.location && (
                <p className="text-red-500 text-xs mt-1">{errors.location}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {text.detailLabel}
              </label>
              <textarea
                value={detail}
                onChange={(e) => {
                  setDetail(e.target.value);
                  setErrors((p) => ({ ...p, detail: "" }));
                }}
                rows={4}
                className={`w-full border rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.detail ? "border-red-400" : "border-slate-200"
                }`}
                placeholder={text.detailPlaceholder}
              />
              {errors.detail && <p className="text-red-500 text-xs mt-1">{errors.detail}</p>}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-200 rounded-xl py-3 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
              >
                {text.cancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {loading ? text.submitting : text.submit}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}