import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ClipboardList, MessageSquareWarning, Settings,
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Check, X as XIcon,
  GripVertical, QrCode, KeyRound,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { AdminComplaintList } from "@/components/AdminComplaintList";
import { DEFAULT_RESTROOMS, DEFAULT_INSPECTION_ITEMS } from "@/data/restrooms";
import {
  subscribeInspectionsByDate,
  subscribeComplaints,
  subscribeRestrooms,
  subscribeInspectionItems,
  addRestroom,
  updateRestroom,
  deleteRestroom,
  addInspectionItem,
  updateInspectionItem,
  deleteInspectionItem,
  reorderRestrooms,
  markComplaintRead,
  markComplaintResolved,
  getBranchAuthSettings,
  updateBranchAuthSettings,
  getBranchSettings,
  updateBranchSettings,
  BranchAuthSettings,
  BranchSettings,
} from "@/lib/firestore";
import { Inspection, Complaint, Restroom, InspectionItem } from "@/types";
import { getCurrentBranchInfo, makeRestroomUrl } from "@/lib/branch";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AdminModeProps {
  onBack: () => void;
}

type Tab = "inspection" | "complaints" | "manage";
type ManageTab = "restrooms" | "items" | "branch";

function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function DailyInspectionView({
  restrooms,
  inspectionItems,
}: {
  restrooms: Restroom[];
  inspectionItems: InspectionItem[];
}) {
  const [dateStr, setDateStr] = useState(formatDateLocal(new Date()));
  const [inspections, setInspections] = useState<Inspection[]>([]);

  const stepDate = (delta: number) => {
    const d = toLocalDate(dateStr);
    d.setDate(d.getDate() + delta);
    setDateStr(formatDateLocal(d));
  };

  useEffect(() => {
    const d = toLocalDate(dateStr);
    const unsub = subscribeInspectionsByDate(d, setInspections);
    return unsub;
  }, [dateStr]);

  const inspectionsByRestroom = React.useMemo(() => {
    const map: Record<string, Inspection[]> = {};
    restrooms.forEach((r) => { map[r.id] = []; });
    inspections.forEach((ins) => {
      if (map[ins.restroomId]) map[ins.restroomId].push(ins);
      else map[ins.restroomId] = [ins];
    });
    return map;
  }, [inspections, restrooms]);

  const totalChecked = inspections.length;
  const roomsDone = restrooms.filter((r) => (inspectionsByRestroom[r.id]?.length ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-3">
        <button onClick={() => stepDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="flex-1 text-center text-base font-bold text-slate-800 focus:outline-none"
        />
        <button onClick={() => stepDate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
          <ChevronRight size={18} className="text-slate-600" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
          <p className="text-xl font-bold text-slate-800">{restrooms.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">전체</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
          <p className="text-xl font-bold text-green-600">{roomsDone}</p>
          <p className="text-xs text-slate-400 mt-0.5">점검 완료</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
          <p className="text-xl font-bold text-orange-500">{totalChecked}</p>
          <p className="text-xs text-slate-400 mt-0.5">총 점검 횟수</p>
        </div>
      </div>

      {restrooms.length === 0 || inspectionItems.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">데이터를 불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {restrooms.map((room) => {
            const roomInspections = inspectionsByRestroom[room.id] ?? [];
            return (
              <div key={room.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{room.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roomInspections.length > 0 ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {roomInspections.length > 0 ? `${roomInspections.length}회 점검` : "미점검"}
                  </span>
                </div>
                {roomInspections.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-slate-400">이 날 점검 기록 없음</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {roomInspections.map((ins, idx) => {
                      const dt = ins.checkedAt instanceof Date ? ins.checkedAt : (ins.checkedAt as any)?.toDate?.() ?? new Date();
                      const hh = String(dt.getHours()).padStart(2, "0");
                      const mm = String(dt.getMinutes()).padStart(2, "0");
                      const oCount = Object.values(ins.items ?? {}).filter((v) => v === "O").length;
                      const xCount = Object.values(ins.items ?? {}).filter((v) => v === "X").length;
                      return (
                        <div key={ins.id ?? idx}>
                          <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{ins.period}</span>
                              <span className="text-xs text-slate-500">{hh}:{mm}</span>
                              <span className="text-xs text-slate-600 font-medium">{ins.inspectorName}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">O {oCount}</span>
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">X {xCount}</span>
                            </div>
                          </div>
                          <div className="px-4 py-3 flex flex-wrap gap-1.5">
                            {inspectionItems.map((item) => {
                              const r = ins.items?.[item.id];
                              return (
                                <span
                                  key={item.id}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${
                                    r === "O" ? "bg-green-50 text-green-700" :
                                    r === "X" ? "bg-red-50 text-red-600" :
                                    "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {item.label}
                                  <span className="font-bold">{r ?? "-"}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isValidRestroomId(value: string) {
  return /^[a-z0-9_]+$/.test(value);
}

function makeRestroomId(floor: string, name: string, restrooms: Restroom[]) {
  const floorPart = floor.trim().toLowerCase().replace(/\s+/g, "");

  let genderPart = "restroom";
  if (name.includes("여자")) genderPart = "women";
  else if (name.includes("남자")) genderPart = "men";
  else if (name.includes("가족")) genderPart = "family";

  const samePrefixCount = restrooms.filter((r) =>
    r.id.startsWith(`${floorPart}_${genderPart}`)
  ).length;

  return `${floorPart}_${genderPart}_${samePrefixCount + 1}`;
}

function SortableRestroomCard({
  room,
  isEditing,
  editValues,
  onStartEdit,
  onDelete,
  onCopyLink,
  onOpenQr,
  onEditValuesChange,
  onSaveEdit,
  onCancelEdit,
}: {
  room: Restroom;
  isEditing: boolean;
  editValues: Partial<Restroom>;
  onStartEdit: (room: Restroom) => void;
  onDelete: (id: string) => void;
  onCopyLink: (id: string) => void;
  onOpenQr: (id: string) => void;
  onEditValuesChange: (value: Partial<Restroom>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const roomUrl = makeRestroomUrl(room.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "opacity-70" : ""}`}
    >
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">화장실 ID</label>
              <input
                value={room.id}
                readOnly
                className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-400">
                저장된 QR 링크와 연결되므로 ID는 수정할 수 없습니다.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                value={editValues.floor ?? ""}
                onChange={(e) => onEditValuesChange({ ...editValues, floor: e.target.value })}
                placeholder="층"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                value={editValues.name ?? ""}
                onChange={(e) => onEditValuesChange({ ...editValues, name: e.target.value })}
                placeholder="화장실명"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 col-span-2"
              />
            </div>

            <input
              value={editValues.locationLabel ?? ""}
              onChange={(e) => onEditValuesChange({ ...editValues, locationLabel: e.target.value })}
              placeholder="위치 설명"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="flex gap-2">
              <button
                onClick={onSaveEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold"
              >
                <Check size={13} /> 저장
              </button>
              <button
                onClick={onCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600"
              >
                <XIcon size={13} /> 취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  className="mt-0.5 p-1 rounded-md text-slate-400 hover:bg-slate-100 cursor-grab active:cursor-grabbing"
                  title="드래그해서 순서 변경"
                >
                  <GripVertical size={16} />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{room.floor}</span>
                    <span className="text-sm font-semibold text-slate-800">{room.name}</span>
                  </div>
                  {room.locationLabel && <p className="text-xs text-slate-400 mt-0.5">{room.locationLabel}</p>}
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => onStartEdit(room)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(room.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500 font-semibold">ID</p>
              <p className="text-xs text-slate-700 font-mono break-all">{room.id}</p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500 font-semibold">링크</p>
              <p className="text-xs text-slate-700 break-all">{roomUrl}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onCopyLink(room.id)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
              >
                링크 복사
              </button>
              <button
                onClick={() => onOpenQr(room.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
              >
                <QrCode size={13} /> QR 이미지
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RestroomManager({ restrooms }: { restrooms: Restroom[] }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Restroom>>({});
  const [adding, setAdding] = useState(false);
  const [newRoom, setNewRoom] = useState<Restroom>({
    id: "",
    floor: "",
    name: "",
    locationLabel: "",
    order: 0,
  });

  const [localRestrooms, setLocalRestrooms] = useState<Restroom[]>(restrooms);

  useEffect(() => {
    setLocalRestrooms(restrooms);
  }, [restrooms]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const restroomIds = useMemo(() => localRestrooms.map((r) => r.id), [localRestrooms]);

  const startEdit = (r: Restroom) => {
    setEditId(r.id);
    setEditValues({
      floor: r.floor,
      name: r.name,
      locationLabel: r.locationLabel,
      order: r.order,
    });
  };

  const saveEdit = async () => {
    if (!editId) return;

    const trimmedFloor = (editValues.floor ?? "").trim();
    const trimmedName = (editValues.name ?? "").trim();
    const trimmedLocation = (editValues.locationLabel ?? "").trim();

    if (!trimmedFloor || !trimmedName) {
      alert("층과 화장실명은 필수입니다.");
      return;
    }

    try {
      await updateRestroom(editId, {
        floor: trimmedFloor,
        name: trimmedName,
        locationLabel: trimmedLocation,
        order: editValues.order ?? 0,
      });
      setEditId(null);
    } catch (error) {
      console.error(error);
      alert("화장실 수정 중 오류가 발생했습니다.");
    }
  };

  const handleAdd = async () => {
    const trimmedId = newRoom.id.trim().toLowerCase();
    const trimmedFloor = newRoom.floor.trim();
    const trimmedName = newRoom.name.trim();
    const trimmedLocation = newRoom.locationLabel.trim();

    if (!trimmedId || !trimmedFloor || !trimmedName) {
      alert("ID, 층, 화장실명은 필수입니다.");
      return;
    }

    if (!isValidRestroomId(trimmedId)) {
      alert("화장실 ID는 영문 소문자, 숫자, 언더스코어(_)만 사용할 수 있습니다.");
      return;
    }

    const duplicated = localRestrooms.some((r) => r.id === trimmedId);
    if (duplicated) {
      alert("이미 사용 중인 화장실 ID입니다.");
      return;
    }

    try {
      await addRestroom({
        id: trimmedId,
        floor: trimmedFloor,
        name: trimmedName,
        locationLabel: trimmedLocation,
        order: localRestrooms.length + 1,
      });

      setNewRoom({
        id: "",
        floor: "",
        name: "",
        locationLabel: "",
        order: 0,
      });
      setAdding(false);
      alert("화장실이 추가되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "화장실 추가 중 오류가 발생했습니다.");
    }
  };

  const copyRoomLink = async (roomId: string) => {
    try {
      const roomUrl = makeRestroomUrl(roomId);
      await navigator.clipboard.writeText(roomUrl);
      alert("링크가 복사되었습니다.");
    } catch (error) {
      console.error(error);
      alert("링크 복사에 실패했습니다.");
    }
  };

  const openQrImage = (roomId: string) => {
    const roomUrl = makeRestroomUrl(roomId);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(roomUrl)}`;
    window.open(qrUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("삭제 시 해당 화장실은 목록에서 제거되며, 이미 부착된 QR코드는 더 이상 정상 작동하지 않을 수 있습니다.\n계속하시겠습니까?")) return;

    try {
      await deleteRestroom(id);
    } catch (error) {
      console.error(error);
      alert("화장실 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localRestrooms.findIndex((r) => r.id === active.id);
    const newIndex = localRestrooms.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(localRestrooms, oldIndex, newIndex).map((room, index) => ({
      ...room,
      order: index + 1,
    }));

    setLocalRestrooms(moved);

    try {
      await reorderRestrooms(moved);
    } catch (error) {
      console.error(error);
      alert("순서 저장 중 오류가 발생했습니다.");
      setLocalRestrooms(restrooms);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700">화장실 목록</h3>
          <p className="text-xs text-slate-400 mt-1">왼쪽 손잡이를 드래그해서 순서를 바꿀 수 있어요.</p>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus size={13} /> 추가
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">화장실 ID</label>
            <input
              value={newRoom.id}
              onChange={(e) => setNewRoom({ ...newRoom, id: e.target.value.toLowerCase() })}
              placeholder="예: 10f_women_2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="mt-1 text-xs text-slate-400">
              영문 소문자, 숫자, 언더스코어(_)만 사용 가능
            </p>
            <button
              type="button"
              onClick={() =>
                setNewRoom((prev) => ({
                  ...prev,
                  id: makeRestroomId(prev.floor, prev.name, localRestrooms),
                }))
              }
              className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              ID 자동 생성
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              value={newRoom.floor}
              onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
              placeholder="층 (예: 10F)"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              placeholder="화장실명"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 col-span-2"
            />
          </div>

          <input
            value={newRoom.locationLabel}
            onChange={(e) => setNewRoom({ ...newRoom, locationLabel: e.target.value })}
            placeholder="위치 설명 (예: 에스컬레이터 옆)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              저장
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewRoom({ id: "", floor: "", name: "", locationLabel: "", order: 0 });
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={restroomIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localRestrooms.map((room) => (
              <SortableRestroomCard
                key={room.id}
                room={room}
                isEditing={editId === room.id}
                editValues={editValues}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onCopyLink={copyRoomLink}
                onOpenQr={openQrImage}
                onEditValuesChange={setEditValues}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditId(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}


function BranchSettingsManager() {
  const branchInfo = getCurrentBranchInfo();
  const [auth, setAuth] = useState<BranchAuthSettings>({ adminPassword: "", inspectorPassword: "" });
  const [settings, setSettings] = useState<BranchSettings>({ complaintUrl: "", complaintWebhookUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!branchInfo) return;

    let mounted = true;
    setLoading(true);

    Promise.all([getBranchAuthSettings(), getBranchSettings()])
      .then(([authSettings, branchSettings]) => {
        if (!mounted) return;
        setAuth(authSettings);
        setSettings(branchSettings);
      })
      .catch((error) => {
        console.error(error);
        alert("지점 설정을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [branchInfo?.id]);

  if (!branchInfo) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-sm text-slate-500">
        무역센터점 기존 운영 화면에서는 지점별 비밀번호/민원 채널 설정을 사용하지 않습니다.
      </div>
    );
  }

  const save = async () => {
    if (!auth.adminPassword.trim() || !auth.inspectorPassword.trim()) {
      alert("관리자 비밀번호와 점검자 비밀번호를 모두 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      await updateBranchAuthSettings(auth);
      await updateBranchSettings(settings);
      alert("지점 설정이 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("지점 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-sm text-slate-400">
        지점 설정을 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-700">{branchInfo.name} 비밀번호 관리</h3>
            <p className="text-xs text-slate-400 mt-0.5">해당 지점 관리자/점검자 비밀번호만 변경됩니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">관리자 비밀번호</label>
            <input
              type="password"
              value={auth.adminPassword}
              onChange={(e) => setAuth({ ...auth, adminPassword: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="관리자 비밀번호"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">점검자 비밀번호</label>
            <input
              type="password"
              value={auth.inspectorPassword}
              onChange={(e) => setAuth({ ...auth, inspectorPassword: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="점검자 비밀번호"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">민원 채널 설정</h3>
          <p className="text-xs text-slate-400 mt-0.5">아직 채널이 없으면 비워두셔도 됩니다.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">민원 접수 링크</label>
          <input
            value={settings.complaintUrl}
            onChange={(e) => setSettings({ ...settings, complaintUrl: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="추후 입력"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">민원 알림 Webhook URL</label>
          <input
            value={settings.complaintWebhookUrl}
            onChange={(e) => setSettings({ ...settings, complaintWebhookUrl: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="추후 입력"
          />
          <p className="text-xs text-slate-400 mt-1">비워두면 해당 지점 민원은 저장만 되고 외부 알림은 보내지 않습니다.</p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "저장 중..." : "지점 설정 저장"}
      </button>
    </div>
  );
}

function InspectionItemManager({ items }: { items: InspectionItem[] }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const saveEdit = async () => {
    if (!editId || !editLabel.trim()) return;
    await updateInspectionItem(editId, { label: editLabel.trim() });
    setEditId(null);
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await addInspectionItem({ label: newLabel.trim(), order: items.length + 1 });
    setNewLabel("");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">점검 항목</h3>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus size={13} /> 추가
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="항목명 (예: 환기팬)"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={handleAdd} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">저장</button>
          <button onClick={() => setAdding(false)} className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600">취소</button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
            {editId === item.id ? (
              <div className="flex flex-1 gap-2">
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button onClick={saveEdit} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold">저장</button>
                <button onClick={() => setEditId(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600">취소</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-5 text-center">{item.order}</span>
                  <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditId(item.id); setEditLabel(item.label); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                  <button onClick={() => deleteInspectionItem(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminMode({ onBack }: AdminModeProps) {
  const [restrooms, setRestrooms] = useState<Restroom[]>(DEFAULT_RESTROOMS);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(DEFAULT_INSPECTION_ITEMS);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [tab, setTab] = useState<Tab>("inspection");
  const [manageTab, setManageTab] = useState<ManageTab>("restrooms");
  const branchInfo = getCurrentBranchInfo();

  const unreadCount = complaints.filter((c) => !c.isRead).length;

  useEffect(() => {
    const u1 = subscribeRestrooms(setRestrooms);
    const u2 = subscribeInspectionItems(setInspectionItems);
    const u3 = subscribeComplaints(setComplaints);
    return () => { u1(); u2(); u3(); };
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "inspection", label: "점검 현황", icon: <ClipboardList size={15} /> },
    { key: "complaints", label: "민원", icon: <MessageSquareWarning size={15} />, badge: unreadCount },
    { key: "manage", label: "관리", icon: <Settings size={15} /> },
  ];

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
          <div>
            <h1 className="text-lg font-bold text-slate-800">{branchInfo ? `${branchInfo.name} 관리자 모드` : "관리자 모드"}</h1>
            <p className="text-xs text-slate-400">일자별 점검 현황 · 항목 관리</p>
          </div>
        </div>

        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors relative ${
                tab === t.key
                  ? "bg-slate-800 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "inspection" && (
          <DailyInspectionView restrooms={restrooms} inspectionItems={inspectionItems} />
        )}

        {tab === "complaints" && (
          <AdminComplaintList
            complaints={complaints}
             onMarkRead={markComplaintRead}
             onMarkResolved={markComplaintResolved}
           />
        )}

        {tab === "manage" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setManageTab("restrooms")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  manageTab === "restrooms" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                화장실
              </button>
              <button
                onClick={() => setManageTab("items")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  manageTab === "items" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                점검 항목
              </button>
              {branchInfo && (
                <button
                  onClick={() => setManageTab("branch")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    manageTab === "branch" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  지점 설정
                </button>
              )}
            </div>

            {manageTab === "restrooms" && <RestroomManager restrooms={restrooms} />}
            {manageTab === "items" && <InspectionItemManager items={inspectionItems} />}
            {manageTab === "branch" && <BranchSettingsManager />}
          </div>
        )}
      </div>
    </Layout>
  );
}