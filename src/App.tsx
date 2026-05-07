import {
  BarChart3,
  CalendarDays,
  Circle,
  Clock3,
  Database,
  Edit3,
  Layers3,
  Milestone as MilestoneIcon,
  PauseCircle,
  Plus,
  RotateCcw,
  Ruler,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNow } from "./hooks/useNow";
import { useLifeStore } from "./store/lifeStore";
import type {
  ExcludedPeriod,
  LifeProject,
  LifeStage,
  Milestone,
  StageStatus,
} from "./types/life";
import { formatDuration } from "./utils/formatDuration";
import {
  clamp,
  clipInterval,
  getDuration,
  mergeIntervals,
  toInterval,
  type TimeInterval,
} from "./utils/intervals";
import { computeProjectProgress, computeStageProgress } from "./utils/progress";
import { parseLocalDate } from "./utils/date";

const COLORS = ["#2563eb", "#059669", "#7c3aed", "#dc2626", "#0891b2"];
const DAY_MS = 24 * 60 * 60 * 1000;

type ProjectFormValue = {
  name: string;
  description: string;
};

type StageFormValue = {
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  description: string;
  tags: string;
};

type ExcludedFormValue = {
  name: string;
  startDate: string;
  endDate: string;
  reason: string;
  countAsExcluded: boolean;
};

type MilestoneFormValue = {
  name: string;
  date: string;
  description: string;
};

type AppPage = "overview" | "scale" | "stages" | "data";
type ScaleViewMode = "full" | "now";
type ProjectRange = {
  startMs: number;
  endMs: number;
};

function inputDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function todayLabel(now: Date): string {
  return format(now, "yyyy 年 M 月 d 日 HH:mm", { locale: zhCN });
}

function compactDate(dateString: string): string {
  return format(parseLocalDate(dateString), "yyyy.MM.dd");
}

function formatMsDate(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd");
}

function segmentRadiusClass({
  clipLeft,
  clipRight,
}: {
  clipLeft: boolean;
  clipRight: boolean;
}): string {
  if (clipLeft && clipRight) {
    return "rounded-none";
  }

  if (clipLeft) {
    return "rounded-r-full rounded-l-none";
  }

  if (clipRight) {
    return "rounded-l-full rounded-r-none";
  }

  return "rounded-full";
}

function getProjectRange(project: LifeProject): ProjectRange | null {
  const intervals = project.stages
    .map((stage) => toInterval(stage.startDate, stage.endDate))
    .filter((interval): interval is TimeInterval => interval !== null);

  if (intervals.length === 0) {
    return null;
  }

  return {
    startMs: Math.min(...intervals.map((interval) => interval.startMs)),
    endMs: Math.max(...intervals.map((interval) => interval.endMs)),
  };
}

function statusLabel(status: StageStatus): string {
  const labels: Record<StageStatus, string> = {
    not_started: "尚未开始",
    active: "进行中",
    completed: "已完成",
    invalid: "配置无效",
  };
  return labels[status];
}

function hasValidRange(startDate: string, endDate: string): boolean {
  return toInterval(startDate, endDate) !== null;
}

function isDateInStage(date: string, stage: LifeStage): boolean {
  const interval = toInterval(stage.startDate, stage.endDate);
  const dateMs = parseLocalDate(date).getTime();
  return Boolean(interval && dateMs >= interval.startMs && dateMs < interval.endMs);
}

function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  title?: string;
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };

  return (
    <button
      aria-label={title}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
      disabled={disabled}
      title={title}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-slate-900 shadow-sm"
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea
        className="min-h-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ObservationControl({
  project,
  actualNow,
  scaleViewMode,
  onScaleViewModeChange,
  showOverviewScale,
  onToggleOverviewScale,
}: {
  project: LifeProject;
  actualNow: Date;
  scaleViewMode: ScaleViewMode;
  onScaleViewModeChange: (value: ScaleViewMode) => void;
  showOverviewScale: boolean;
  onToggleOverviewScale: (value: boolean) => void;
}) {
  const range = getProjectRange(project);

  if (!range) {
    return null;
  }

  const visibleEndMs =
    scaleViewMode === "now"
      ? clamp(actualNow.getTime(), range.startMs + DAY_MS, range.endMs)
      : range.endMs;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">总刻度</h2>
          <p className="mt-1 text-sm text-slate-500">
            可以单独控制整条时间轴顶部总刻度是否显示，下面的阶段结构会保留。
          </p>
        </div>
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          {inputDate(actualNow)}
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            可见范围：{formatMsDate(range.startMs)} - {formatMsDate(visibleEndMs - DAY_MS)}
          </div>
          <div className="inline-flex rounded-md bg-white p-1 ring-1 ring-slate-200">
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                scaleViewMode === "full"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              type="button"
              onClick={() => onScaleViewModeChange("full")}
            >
              完整模式
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                scaleViewMode === "now"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              type="button"
              onClick={() => onScaleViewModeChange("now")}
            >
              现在模式
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            现在模式会把“现在”之后的内容全部隐藏，当前时间会贴到最右侧。
          </p>
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
            <button
              aria-pressed={showOverviewScale}
              className={`relative h-7 w-12 rounded-full transition ${
                showOverviewScale ? "bg-slate-900" : "bg-slate-300"
              }`}
              type="button"
              onClick={() => onToggleOverviewScale(!showOverviewScale)}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  showOverviewScale ? "left-6" : "left-1"
                }`}
              />
            </button>
            {showOverviewScale ? "显示总刻度" : "隐藏总刻度"}
          </label>
        </div>
      </div>
    </section>
  );
}

function StatBadge({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: StageStatus }) {
  const styles: Record<StageStatus, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    completed: "bg-slate-100 text-slate-700 ring-slate-200",
    not_started: "bg-blue-50 text-blue-700 ring-blue-100",
    invalid: "bg-red-50 text-red-700 ring-red-100",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function PageNav({
  activePage,
  onChange,
}: {
  activePage: AppPage;
  onChange: (page: AppPage) => void;
}) {
  const items: Array<{ id: AppPage; label: string; icon: ReactNode }> = [
    { id: "overview", label: "概览", icon: <BarChart3 size={16} /> },
    { id: "scale", label: "长刻度", icon: <Ruler size={16} /> },
    { id: "stages", label: "阶段管理", icon: <Layers3 size={16} /> },
    { id: "data", label: "数据", icon: <Database size={16} /> },
  ];

  return (
    <nav className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8" aria-label="主要页面">
      <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        {items.map((item) => (
          <button
            key={item.id}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium transition ${
              activePage === item.id
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            type="button"
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}


function ProjectForm({
  initialValue,
  submitLabel,
  onSubmit,
}: {
  initialValue?: ProjectFormValue;
  submitLabel: string;
  onSubmit: (value: ProjectFormValue) => void;
}) {
  const [value, setValue] = useState<ProjectFormValue>(
    initialValue ?? { name: "", description: "" }
  );
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!value.name.trim()) {
      setError("时间轴名称不能为空。");
      return;
    }

    onSubmit({ name: value.name.trim(), description: value.description.trim() });
    setError("");

    if (!initialValue) {
      setValue({ name: "", description: "" });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <TextInput
        required
        label="时间轴名称"
        value={value.name}
        onChange={(name) => setValue((current) => ({ ...current, name }))}
      />
      <TextArea
        label="描述"
        value={value.description}
        onChange={(description) => setValue((current) => ({ ...current, description }))}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit">
        <Plus size={16} />
        {submitLabel}
      </Button>
    </form>
  );
}

function StageForm({
  initialValue,
  submitLabel,
  onSubmit,
}: {
  initialValue?: StageFormValue;
  submitLabel: string;
  onSubmit: (value: StageFormValue) => void;
}) {
  const now = new Date();
  const [value, setValue] = useState<StageFormValue>(
    initialValue ?? {
      name: "",
      startDate: inputDate(now),
      endDate: inputDate(new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())),
      color: COLORS[0],
      description: "",
      tags: "",
    }
  );
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!value.name.trim()) {
      setError("阶段名称不能为空。");
      return;
    }

    if (!value.startDate || !value.endDate) {
      setError("开始日期和结束日期都需要填写。");
      return;
    }

    if (!hasValidRange(value.startDate, value.endDate)) {
      setError("结束日期不能早于开始日期。");
      return;
    }

    onSubmit({
      ...value,
      name: value.name.trim(),
      description: value.description.trim(),
      tags: value.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(","),
    });
    setError("");

    if (!initialValue) {
      setValue({
        name: "",
        startDate: inputDate(now),
        endDate: inputDate(new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())),
        color: COLORS[0],
        description: "",
        tags: "",
      });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          required
          label="阶段名称"
          value={value.name}
          onChange={(name) => setValue((current) => ({ ...current, name }))}
        />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>颜色</span>
          <div className="flex min-h-10 flex-wrap items-center gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                aria-label={`选择颜色 ${color}`}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${
                  value.color === color ? "ring-slate-900" : "ring-transparent"
                }`}
                style={{ backgroundColor: color }}
                type="button"
                onClick={() => setValue((current) => ({ ...current, color }))}
              />
            ))}
          </div>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          required
          label="开始日期"
          type="date"
          value={value.startDate}
          onChange={(startDate) => setValue((current) => ({ ...current, startDate }))}
        />
        <TextInput
          required
          label="结束日期"
          type="date"
          value={value.endDate}
          onChange={(endDate) => setValue((current) => ({ ...current, endDate }))}
        />
      </div>
      <TextInput
        label="标签（用逗号分隔）"
        value={value.tags}
        onChange={(tags) => setValue((current) => ({ ...current, tags }))}
      />
      <TextArea
        label="描述"
        value={value.description}
        onChange={(description) => setValue((current) => ({ ...current, description }))}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit">
        <Plus size={16} />
        {submitLabel}
      </Button>
    </form>
  );
}

function ExcludedPeriodForm({
  stage,
  initialValue,
  submitLabel,
  onSubmit,
}: {
  stage: LifeStage;
  initialValue?: ExcludedFormValue;
  submitLabel: string;
  onSubmit: (value: ExcludedFormValue) => void;
}) {
  const [value, setValue] = useState<ExcludedFormValue>(
    initialValue ?? {
      name: "",
      startDate: stage.startDate,
      endDate: stage.startDate,
      reason: "",
      countAsExcluded: true,
    }
  );
  const [error, setError] = useState("");
  const stageInterval = toInterval(stage.startDate, stage.endDate);
  const periodInterval = toInterval(value.startDate, value.endDate);
  const clippedPeriodInterval =
    stageInterval && periodInterval ? clipInterval(periodInterval, stageInterval) : null;
  const willClip = Boolean(
    stageInterval &&
      periodInterval &&
      getDuration(periodInterval) >
        getDuration(clippedPeriodInterval ?? { startMs: 0, endMs: 0 })
  );

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!value.name.trim()) {
      setError("排除时间段名称不能为空。");
      return;
    }

    if (!value.startDate || !value.endDate) {
      setError("开始日期和结束日期都需要填写。");
      return;
    }

    if (!hasValidRange(value.startDate, value.endDate)) {
      setError("结束日期不能早于开始日期。");
      return;
    }

    onSubmit({
      ...value,
      name: value.name.trim(),
      reason: value.reason.trim(),
    });
    setError("");

    if (!initialValue) {
      setValue({
        name: "",
        startDate: stage.startDate,
        endDate: stage.startDate,
        reason: "",
        countAsExcluded: true,
      });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <TextInput
        required
        label="名称"
        value={value.name}
        onChange={(name) => setValue((current) => ({ ...current, name }))}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          required
          label="开始日期"
          type="date"
          value={value.startDate}
          onChange={(startDate) => setValue((current) => ({ ...current, startDate }))}
        />
        <TextInput
          required
          label="结束日期"
          type="date"
          value={value.endDate}
          onChange={(endDate) => setValue((current) => ({ ...current, endDate }))}
        />
      </div>
      <TextArea
        label="原因 / 备注"
        value={value.reason}
        onChange={(reason) => setValue((current) => ({ ...current, reason }))}
      />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          checked={value.countAsExcluded}
          className="h-4 w-4"
          type="checkbox"
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              countAsExcluded: event.target.checked,
            }))
          }
        />
        这段时间会在时间轴上标记为排除
      </label>
      {willClip && (
        <p className="text-sm text-amber-700">
          这段时间有一部分超出阶段范围，保存后计算会自动裁剪。
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit">
        <Plus size={16} />
        {submitLabel}
      </Button>
    </form>
  );
}

function MilestoneForm({
  stage,
  initialValue,
  submitLabel,
  onSubmit,
}: {
  stage: LifeStage;
  initialValue?: MilestoneFormValue;
  submitLabel: string;
  onSubmit: (value: MilestoneFormValue) => void;
}) {
  const [value, setValue] = useState<MilestoneFormValue>(
    initialValue ?? { name: "", date: stage.startDate, description: "" }
  );
  const [error, setError] = useState("");
  const outsideStage = value.date ? !isDateInStage(value.date, stage) : false;

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!value.name.trim()) {
      setError("里程碑名称不能为空。");
      return;
    }

    if (!value.date) {
      setError("里程碑日期不能为空。");
      return;
    }

    onSubmit({
      ...value,
      name: value.name.trim(),
      description: value.description.trim(),
    });
    setError("");

    if (!initialValue) {
      setValue({ name: "", date: stage.startDate, description: "" });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <TextInput
        required
        label="名称"
        value={value.name}
        onChange={(name) => setValue((current) => ({ ...current, name }))}
      />
      <TextInput
        required
        label="日期"
        type="date"
        value={value.date}
        onChange={(date) => setValue((current) => ({ ...current, date }))}
      />
      <TextArea
        label="描述"
        value={value.description}
        onChange={(description) => setValue((current) => ({ ...current, description }))}
      />
      {outsideStage && (
        <p className="text-sm text-amber-700">
          这个里程碑不在阶段日期内，仍会保存为参考事件。
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit">
        <Plus size={16} />
        {submitLabel}
      </Button>
    </form>
  );
}

function Timeline({
  stage,
  now,
}: {
  stage: LifeStage;
  now: Date;
}) {
  const stageInterval = toInterval(stage.startDate, stage.endDate);

  if (!stageInterval) {
    return <p className="text-sm text-red-700">阶段日期无效，暂时无法显示时间线。</p>;
  }

  const stageTotal = getDuration(stageInterval);
  const nowInsideStage =
    now.getTime() >= stageInterval.startMs && now.getTime() <= stageInterval.endMs;
  const activeExclusions = mergeIntervals(
    stage.excludedPeriods
      .filter((period) => period.countAsExcluded)
      .map((period) => toInterval(period.startDate, period.endDate))
      .filter((interval): interval is TimeInterval => interval !== null)
      .map((interval) => clipInterval(interval, stageInterval))
      .filter((interval): interval is TimeInterval => interval !== null)
  );
  const nowPercent = clamp(
    ((now.getTime() - stageInterval.startMs) / stageTotal) * 100,
    0,
    100
  );
  const elapsedPercent = nowInsideStage
    ? nowPercent
    : now.getTime() > stageInterval.endMs
      ? 100
      : 0;

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-5 rounded-full bg-slate-300" />
          阶段总刻度
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-5 rounded-full bg-blue-500" />
          已经过的日历时间
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="hatched h-3 w-5 rounded-sm ring-1 ring-slate-300" />
          排除时间段
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-0.5 bg-red-600" />
          现在
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-4 w-0.5 bg-slate-700" />
          里程碑
        </span>
      </div>

      <div className="relative h-24">
        <div className="absolute inset-x-0 top-10 h-8 overflow-hidden rounded-md border border-slate-300 bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 bg-blue-500/70"
            style={{ width: `${elapsedPercent}%` }}
            title="已经过的日历时间"
          />
          {activeExclusions.map((interval) => {
            const left = clamp(
              ((interval.startMs - stageInterval.startMs) / stageTotal) * 100,
              0,
              100
            );
            const width = clamp((getDuration(interval) / stageTotal) * 100, 0, 100 - left);
            return (
              <div
                key={`${interval.startMs}-${interval.endMs}`}
                className="hatched absolute inset-y-0"
                style={{ left: `${left}%`, width: `${width}%` }}
                title="自主排除的时间"
              />
            );
          })}
        </div>
        {nowInsideStage && (
          <div
            className="absolute top-4 z-10 h-16 w-0.5 bg-red-600"
            style={{ left: `${nowPercent}%` }}
            title="当前时间"
          >
            <span
              className={`absolute top-0 whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white ${
                nowPercent > 84 ? "right-2" : "left-2"
              }`}
            >
              现在
            </span>
          </div>
        )}
        {stage.milestones.map((milestone) => {
          const dateMs = parseLocalDate(milestone.date).getTime();
          const left = clamp(((dateMs - stageInterval.startMs) / stageTotal) * 100, 0, 100);
          const alignRight = left > 78;
          return (
            <div
              key={milestone.id}
              className="absolute top-3 z-20 h-16 w-0.5 bg-slate-700"
              style={{ left: `${left}%` }}
              title={`${milestone.name} · ${milestone.date}`}
            >
              <span
                className={`absolute top-0 max-w-36 truncate rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 ${
                  alignRight ? "right-2" : "left-2"
                }`}
              >
                {milestone.name}
              </span>
            </div>
          );
        })}
        <span className="absolute left-0 top-20 text-xs text-slate-500">起点</span>
        <span className="absolute right-0 top-20 text-xs text-slate-500">终点</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{stage.startDate}</span>
        <span>{stage.endDate}</span>
      </div>
    </div>
  );
}

function ProjectLongScale({
  project,
  now,
  scaleViewMode,
  showOverviewScale,
}: {
  project: LifeProject;
  now: Date;
  scaleViewMode: ScaleViewMode;
  showOverviewScale: boolean;
}) {
  const stageRows = project.stages
    .map((stage) => ({
      stage,
      interval: toInterval(stage.startDate, stage.endDate),
    }))
    .filter(
      (entry): entry is { stage: LifeStage; interval: TimeInterval } =>
        entry.interval !== null
    )
    .sort((a, b) => a.interval.startMs - b.interval.startMs);

  if (stageRows.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">整条时间轴</h2>
        <p className="mt-2 text-sm text-slate-500">
          添加有效阶段后，这里会显示一条适配页面宽度的完整时间刻度。
        </p>
      </section>
    );
  }

  const absoluteStartMs = Math.min(...stageRows.map((row) => row.interval.startMs));
  const absoluteEndMs = Math.max(...stageRows.map((row) => row.interval.endMs));
  const visibleRange: TimeInterval = {
    startMs: absoluteStartMs,
    endMs:
      scaleViewMode === "now"
        ? clamp(now.getTime(), absoluteStartMs + DAY_MS, absoluteEndMs)
        : absoluteEndMs,
  };
  const visibleStageRows = stageRows
    .map((row) => ({
      ...row,
      visibleInterval: clipInterval(row.interval, visibleRange),
    }))
    .filter(
      (
        row
      ): row is {
        stage: LifeStage;
        interval: TimeInterval;
        visibleInterval: TimeInterval;
      } => row.visibleInterval !== null
    );
  const startMs = visibleRange.startMs;
  const endMs = visibleRange.endMs;
  const totalDays = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
  const useYearTicks = totalDays > 1100;
  const ticks: Date[] = [];
  const firstDate = new Date(startMs);

  if (useYearTicks) {
    const tick = new Date(firstDate.getFullYear(), 0, 1);
    while (tick.getTime() < startMs) {
      tick.setFullYear(tick.getFullYear() + 1);
    }
    while (tick.getTime() <= endMs) {
      ticks.push(new Date(tick));
      tick.setFullYear(tick.getFullYear() + 1);
    }
  } else {
    const tick = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (tick.getTime() < startMs) {
      tick.setMonth(tick.getMonth() + 1);
    }
    while (tick.getTime() <= endMs) {
      ticks.push(new Date(tick));
      tick.setMonth(tick.getMonth() + 1);
    }
  }

  function percentFromMs(ms: number): number {
    const span = Math.max(1, endMs - startMs);
    return clamp(((ms - startMs) / span) * 100, 0, 100);
  }

  const nowPercent = percentFromMs(now.getTime());
  const nowWithinProject = now.getTime() >= startMs && now.getTime() <= endMs;
  const projectEndedBeforeNow = now.getTime() > absoluteEndMs;
  const showRangeMarker = scaleViewMode === "now" || nowWithinProject;
  const rangeMarkerPercent = scaleViewMode === "now" ? 100 : nowPercent;
  const rangeMarkerLabel =
    scaleViewMode === "now"
      ? projectEndedBeforeNow
        ? "已结束"
        : "现在"
      : "现在";
  const rangeMarkerAlignRight = rangeMarkerPercent > 84;
  const rangeMarkerTitle =
    scaleViewMode === "now" && projectEndedBeforeNow ? "时间轴最终日期" : "当前时间";
  const visibleTicks = ticks.filter((_, index) => {
    if (ticks.length <= 9) {
      return true;
    }

    const interval = Math.ceil(ticks.length / 8);
    return index % interval === 0 || index === ticks.length - 1;
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">整条时间轴</h2>
          <p className="mt-1 text-sm text-slate-500">
            总刻度和每个阶段共用同一套时间坐标；颜色块代表阶段区间，实心部分代表该阶段已经走到哪里。
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {format(new Date(startMs), "yyyy.MM.dd")} -{" "}
          {format(new Date(endMs - DAY_MS), "yyyy.MM.dd")}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3">
          {showOverviewScale && (
            <div className="grid gap-3 border-b border-slate-200 pb-4 md:grid-cols-[220px_1fr]">
              <div>
                <p className="text-sm font-semibold text-slate-900">总刻度</p>
                <p className="mt-1 text-xs text-slate-500">{totalDays} 天</p>
              </div>
              <div className="relative h-20">
                <div className="absolute inset-x-0 top-9 h-3 rounded-full bg-slate-200" />
                {visibleTicks.map((tick) => {
                  const left = percentFromMs(tick.getTime());
                  const alignRight = left > 88;
                  return (
                    <div
                      key={tick.toISOString()}
                      className="absolute top-3 h-12 border-l border-slate-300"
                      style={{ left: `${left}%` }}
                    >
                      <span
                        className={`absolute top-0 whitespace-nowrap text-xs text-slate-500 ${
                          alignRight ? "right-1" : "left-1"
                        }`}
                      >
                        {format(tick, useYearTicks ? "yyyy" : "yyyy.MM")}
                      </span>
                    </div>
                  );
                })}
                {showRangeMarker && (
                  <div
                    className="absolute top-0 z-10 h-16 border-l-2 border-red-600"
                    style={{ left: `${rangeMarkerPercent}%` }}
                    title={rangeMarkerTitle}
                  >
                    <span
                      className={`absolute top-0 whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white ${
                        rangeMarkerAlignRight ? "right-2" : "left-2"
                      }`}
                    >
                      {rangeMarkerLabel}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-slate-500">
                  <span>{format(new Date(startMs), "yyyy.MM.dd")}</span>
                  <span>{format(new Date(endMs - DAY_MS), "yyyy.MM.dd")}</span>
                </div>
              </div>
            </div>
          )}

          {visibleStageRows.map(({ stage, interval, visibleInterval }) => {
            const left = percentFromMs(visibleInterval.startMs);
            const right = percentFromMs(visibleInterval.endMs);
            const width = Math.max(1, right - left);
            const clipsLeft = visibleInterval.startMs > interval.startMs;
            const clipsRight = visibleInterval.endMs < interval.endMs;
            const stageRadiusClass = segmentRadiusClass({
              clipLeft: clipsLeft,
              clipRight: clipsRight,
            });
            const stageProgress = computeStageProgress(stage, now);
            const elapsedWidth = Math.max(
              0,
              (width * clamp(stageProgress.natural.percentage, 0, 100)) / 100
            );
            const activeExclusions = mergeIntervals(
              stage.excludedPeriods
                .filter((period) => period.countAsExcluded)
                .map((period) => toInterval(period.startDate, period.endDate))
                .filter((excluded): excluded is TimeInterval => excluded !== null)
                .map((excluded) => clipInterval(excluded, visibleInterval))
                .filter((excluded): excluded is TimeInterval => excluded !== null)
            );

            return (
              <div
                key={stage.id}
                className="grid gap-3 rounded-lg bg-white p-4 md:grid-cols-[220px_1fr]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: stage.color ?? "#2563eb" }}
                    />
                    <h3 className="truncate font-semibold text-slate-950">{stage.name}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {compactDate(stage.startDate)} - {compactDate(stage.endDate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDuration(interval.endMs - interval.startMs)} ·{" "}
                    {statusLabel(stageProgress.status)}
                  </p>
                </div>

                <div className="relative h-24">
                  <div className="absolute inset-x-0 top-0 h-16">
                    {visibleTicks.map((tick) => (
                      <div
                        key={`${stage.id}-${tick.toISOString()}`}
                        className="absolute inset-y-0 border-l border-slate-200"
                        style={{ left: `${percentFromMs(tick.getTime())}%` }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-x-0 top-9 h-6 rounded-full bg-slate-100" />
                  <div
                    className={`absolute top-9 h-6 ring-1 ring-black/5 ${stageRadiusClass}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: `${stage.color ?? "#2563eb"}22`,
                    }}
                    title={`${stage.name}: ${stage.startDate} 至 ${stage.endDate}`}
                  />
                  <div
                    className={`absolute top-9 h-6 shadow-sm ${stageRadiusClass}`}
                    style={{
                      left: `${left}%`,
                      width: `${elapsedWidth}%`,
                      backgroundColor: stage.color ?? "#2563eb",
                    }}
                    title={`${stage.name} 已经过的时间`}
                  />
                  {activeExclusions.map((excluded) => {
                    const excludedLeft = percentFromMs(excluded.startMs);
                    const excludedRight = percentFromMs(excluded.endMs);
                    const exclusionRadiusClass = segmentRadiusClass({
                      clipLeft: excluded.startMs > interval.startMs,
                      clipRight: excluded.endMs < interval.endMs,
                    });
                    return (
                      <div
                        key={`${excluded.startMs}-${excluded.endMs}`}
                        className={`hatched absolute top-9 h-6 ring-1 ring-slate-300 ${exclusionRadiusClass}`}
                        style={{
                          left: `${excludedLeft}%`,
                          width: `${Math.max(1, excludedRight - excludedLeft)}%`,
                        }}
                        title="排除时间段"
                      />
                    );
                  })}
                  {showRangeMarker && (
                    <div
                      className="absolute top-1 z-10 h-16 border-l-2 border-red-600"
                      style={{ left: `${rangeMarkerPercent}%` }}
                      title={rangeMarkerTitle}
                    >
                      {rangeMarkerPercent >= left && rangeMarkerPercent <= right && (
                        <span
                          className={`absolute top-0 whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white ${
                            rangeMarkerAlignRight ? "right-2" : "left-2"
                          }`}
                        >
                          {rangeMarkerLabel}
                        </span>
                      )}
                    </div>
                  )}
                  {stage.milestones.map((milestone) => {
                    const milestoneMs = parseLocalDate(milestone.date).getTime();

                    if (milestoneMs < startMs || milestoneMs > endMs) {
                      return null;
                    }

                    const left = percentFromMs(milestoneMs);
                    const alignRight = left > 78;
                    return (
                      <div
                        key={milestone.id}
                        className="absolute top-1 h-16 w-0.5 bg-slate-700"
                        style={{ left: `${left}%` }}
                        title={`${milestone.name} · ${milestone.date}`}
                      >
                        <span
                          className={`absolute top-0 max-w-32 truncate rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 ${
                            alignRight ? "right-2" : "left-2"
                          }`}
                        >
                          {milestone.name}
                        </span>
                      </div>
                    );
                  })}
                  <p className="absolute left-0 bottom-0 text-xs text-slate-500">
                    {compactDate(stage.startDate)}
                  </p>
                  <p className="absolute right-0 bottom-0 text-xs text-slate-500">
                    {compactDate(stage.endDate)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProjectList({
  projects,
  selectedProjectId,
  now,
}: {
  projects: LifeProject[];
  selectedProjectId?: string;
  now: Date;
}) {
  const selectProject = useLifeStore((state) => state.selectProject);
  const deleteProject = useLifeStore((state) => state.deleteProject);
  const createProject = useLifeStore((state) => state.createProject);

  return (
    <aside className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">新建时间轴</h2>
        <p className="mt-1 text-sm text-slate-500">
          可以只维护一条「我的一生」，也可以为某段主题单独建一条时间轴。
        </p>
        <div className="mt-4">
          <ProjectForm submitLabel="新建时间轴" onSubmit={createProject} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">时间轴</h2>
          <span className="text-sm text-slate-500">{projects.length} 个</span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            新建一条时间轴，开始整理你的阶段、暂停期与里程碑。
          </div>
        ) : (
          projects.map((project) => {
            const progress = computeProjectProgress(project, now);
            const activeStage = project.stages.find(
              (stage) => stage.id === progress.activeStageId
            );
            const isSelected = project.id === selectedProjectId;
            return (
              <article
                key={project.id}
                className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                  isSelected ? "border-slate-900" : "border-slate-200"
                }`}
              >
                <button
                  className="grid w-full gap-2 text-left"
                  type="button"
                  onClick={() => selectProject(project.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-950">
                      {project.name}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {project.stages.length} 阶段
                    </span>
                  </div>
                  {project.description && (
                    <p className="line-clamp-2 text-sm text-slate-500">
                      {project.description}
                    </p>
                  )}
                  <p className="text-sm text-slate-600">
                    当前阶段：{activeStage?.name ?? "暂无进行中的阶段"}
                  </p>
                  <p className="text-sm text-slate-600">
                    总时长：{formatDuration(progress.natural.totalMs)}
                  </p>
                </button>
                <div className="mt-3 flex justify-end">
                  <Button
                    title="删除时间轴"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`删除时间轴「${project.name}」？`)) {
                        deleteProject(project.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    删除
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </aside>
  );
}

function ProjectDetail({
  project,
  now,
  actualNow,
  showOverviewScale,
  onToggleOverviewScale,
  scaleViewMode,
  onScaleViewModeChange,
  activePage,
}: {
  project: LifeProject;
  now: Date;
  actualNow: Date;
  showOverviewScale: boolean;
  onToggleOverviewScale: (value: boolean) => void;
  scaleViewMode: ScaleViewMode;
  onScaleViewModeChange: (value: ScaleViewMode) => void;
  activePage: AppPage;
}) {
  const updateProject = useLifeStore((state) => state.updateProject);
  const createStage = useLifeStore((state) => state.createStage);
  const resetDemoData = useLifeStore((state) => state.resetDemoData);
  const clearAllData = useLifeStore((state) => state.clearAllData);
  const backendStatus = useLifeStore((state) => state.backendStatus);
  const backendStorageInfo = useLifeStore((state) => state.backendStorageInfo);
  const progress = computeProjectProgress(project, now);
  const milestones = project.stages.reduce(
    (sum, stage) => sum + stage.milestones.length,
    0
  );
  const exclusions = project.stages.reduce(
    (sum, stage) => sum + stage.excludedPeriods.length,
    0
  );

  return (
    <main className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">当前观察时间：{todayLabel(now)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 max-w-3xl text-slate-600">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              {activePage === "overview"
                ? "概览"
                : activePage === "scale"
                  ? "长刻度"
                  : activePage === "stages"
                    ? "阶段管理"
                    : "数据"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatBadge
            icon={<Clock3 size={14} />}
            label="时间轴总时长"
            value={formatDuration(progress.natural.totalMs)}
          />
          <StatBadge
            icon={<Clock3 size={14} />}
            label="已走过"
            value={formatDuration(progress.natural.elapsedMs)}
          />
          <StatBadge
            icon={<PauseCircle size={14} />}
            label="自主排除"
            value={formatDuration(progress.excludedTotalMs)}
          />
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 xl:col-span-1">
            <StatBadge
              icon={<MilestoneIcon size={14} />}
              label="里程碑"
              value={milestones}
            />
            <StatBadge icon={<Circle size={14} />} label="排除时间段" value={exclusions} />
          </div>
        </div>

        {progress.warnings.length > 0 && (
          <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            {progress.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </section>

      <ObservationControl
        actualNow={actualNow}
        scaleViewMode={scaleViewMode}
        onScaleViewModeChange={onScaleViewModeChange}
        project={project}
        showOverviewScale={showOverviewScale}
        onToggleOverviewScale={onToggleOverviewScale}
      />

      {activePage === "overview" && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <details>
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                编辑时间轴信息
              </summary>
              <div className="mt-4">
                <ProjectForm
                  key={project.id}
                  initialValue={{
                    name: project.name,
                    description: project.description ?? "",
                  }}
                  submitLabel="保存时间轴"
                  onSubmit={(value) => updateProject(project.id, value)}
                />
              </div>
            </details>
          </section>
        </>
      )}

      {activePage === "scale" && (
        <ProjectLongScale
          project={project}
          now={now}
          scaleViewMode={scaleViewMode}
          showOverviewScale={showOverviewScale}
        />
      )}

      {activePage === "stages" && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <details>
              <summary className="cursor-pointer text-base font-semibold text-slate-950">
                新建阶段
              </summary>
              <div className="mt-4">
                <StageForm
                  submitLabel="新建阶段"
                  onSubmit={(value) =>
                    createStage(project.id, {
                      ...value,
                      tags: value.tags
                        .split(/[,，]/)
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </details>
          </section>

          <section className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950">阶段</h2>
              <span className="text-sm text-slate-500">
                {project.stages.length} 个阶段
              </span>
            </div>

            {project.stages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-500">
                这条时间轴还没有阶段。添加一个阶段后，就能看到完整时间结构。
              </div>
            ) : (
              [...project.stages]
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((stage) => (
                  <StageCard
                    key={stage.id}
                    now={now}
                    project={project}
                    stage={stage}
                  />
                ))
            )}
          </section>
        </>
      )}

      {activePage === "data" && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">数据</h2>
          <p className="mt-2 text-sm text-slate-500">
            数据会优先同步到后端 JSON 文件；后端不可用时，会继续保存在浏览器本地。
          </p>
          <div className="mt-5 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-slate-700">后端状态</span>
              <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                {backendStatus === "synced"
                  ? "已连接并同步"
                  : backendStatus === "syncing"
                    ? "同步中"
                    : backendStatus === "unavailable"
                      ? "未连接"
                      : "待同步"}
              </span>
            </div>
            {backendStorageInfo ? (
              <>
                <div>
                  <span className="font-medium text-slate-700">数据文件：</span>
                  <span className="break-all text-slate-600">
                    {backendStorageInfo.dataFile}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-700">备份文件：</span>
                  <span className="break-all text-slate-600">
                    {backendStorageInfo.backupFile}
                  </span>
                </div>
                <div className="text-slate-600">
                  {backendStorageInfo.exists
                    ? `文件大小 ${backendStorageInfo.size} bytes，最后修改 ${backendStorageInfo.modifiedAt ?? "未知"}`
                    : "后端文件尚未创建，第一次保存后会自动生成。"}
                </div>
              </>
            ) : (
              <p className="text-slate-600">
                暂未拿到后端存储信息。请确认 `npm run dev:server` 已启动。
              </p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetDemoData}>
              <RotateCcw size={16} />
              重置示例
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm("清空所有本地数据？")) {
                  clearAllData();
                }
              }}
            >
              <Trash2 size={16} />
              清空数据
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

function StageCard({
  project,
  stage,
  now,
}: {
  project: LifeProject;
  stage: LifeStage;
  now: Date;
}) {
  const updateStage = useLifeStore((state) => state.updateStage);
  const deleteStage = useLifeStore((state) => state.deleteStage);
  const createExcludedPeriod = useLifeStore((state) => state.createExcludedPeriod);
  const updateExcludedPeriod = useLifeStore((state) => state.updateExcludedPeriod);
  const deleteExcludedPeriod = useLifeStore((state) => state.deleteExcludedPeriod);
  const createMilestone = useLifeStore((state) => state.createMilestone);
  const updateMilestone = useLifeStore((state) => state.updateMilestone);
  const deleteMilestone = useLifeStore((state) => state.deleteMilestone);
  const progress = computeStageProgress(stage, now);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: stage.color ?? "#2563eb" }}
            />
            <h3 className="text-xl font-semibold text-slate-950">{stage.name}</h3>
            <StatusBadge status={progress.status} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={16} />
            {stage.startDate} 至 {stage.endDate}
          </p>
          {stage.description && <p className="mt-2 text-slate-600">{stage.description}</p>}
          {stage.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {stage.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            title="删除阶段"
            variant="danger"
            onClick={() => {
              if (window.confirm(`删除阶段「${stage.name}」？`)) {
                deleteStage(project.id, stage.id);
              }
            }}
          >
            <Trash2 size={16} />
            删除
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-3 sm:col-span-2 xl:col-span-2 xl:grid-cols-2">
          <StatBadge
            icon={<Clock3 size={14} />}
            label="阶段总时长"
            value={formatDuration(progress.natural.totalMs)}
          />
          <StatBadge
            icon={<Clock3 size={14} />}
            label="已走过"
            value={formatDuration(progress.natural.elapsedMs)}
          />
        </div>
        <div className="grid gap-3 sm:col-span-2 xl:col-span-2 xl:grid-cols-2">
          <StatBadge
            icon={<Clock3 size={14} />}
            label="剩余"
            value={formatDuration(progress.natural.remainingMs)}
          />
          <StatBadge
            icon={<PauseCircle size={14} />}
            label="排除时长"
            value={formatDuration(progress.excludedTotalMs)}
          />
        </div>
      </div>

      <div className="mt-5">
        <Timeline now={now} stage={stage} />
      </div>

      {progress.warnings.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {progress.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <details className="mt-5 rounded-md border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">
          <Edit3 className="mr-2 inline-block" size={16} />
          编辑阶段
        </summary>
        <div className="mt-4">
          <StageForm
            key={stage.id}
            initialValue={{
              name: stage.name,
              startDate: stage.startDate,
              endDate: stage.endDate,
              color: stage.color ?? COLORS[0],
              description: stage.description ?? "",
              tags: stage.tags.join(", "),
            }}
            submitLabel="保存阶段"
            onSubmit={(value) =>
              updateStage(project.id, stage.id, {
                ...value,
                tags: value.tags
                  .split(/[,，]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </details>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ExcludedPeriodSection
          periods={stage.excludedPeriods}
          stage={stage}
          onCreate={(value) => createExcludedPeriod(project.id, stage.id, value)}
          onDelete={(period) => deleteExcludedPeriod(project.id, stage.id, period.id)}
          onUpdate={(period, value) =>
            updateExcludedPeriod(project.id, stage.id, period.id, value)
          }
        />
        <MilestoneSection
          milestones={stage.milestones}
          stage={stage}
          onCreate={(value) => createMilestone(project.id, stage.id, value)}
          onDelete={(milestone) => deleteMilestone(project.id, stage.id, milestone.id)}
          onUpdate={(milestone, value) =>
            updateMilestone(project.id, stage.id, milestone.id, value)
          }
        />
      </div>
    </article>
  );
}

function ExcludedPeriodSection({
  stage,
  periods,
  onCreate,
  onUpdate,
  onDelete,
}: {
  stage: LifeStage;
  periods: ExcludedPeriod[];
  onCreate: (value: ExcludedFormValue) => void;
  onUpdate: (period: ExcludedPeriod, value: ExcludedFormValue) => void;
  onDelete: (period: ExcludedPeriod) => void;
}) {
  return (
    <section className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-950">排除时间段</h4>
        <span className="text-sm text-slate-500">{periods.length} 个</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">这些时间段会在时间轴上单独标出来。</p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          添加排除时间段
        </summary>
        <div className="mt-3">
          <ExcludedPeriodForm stage={stage} submitLabel="添加排除时间段" onSubmit={onCreate} />
        </div>
      </details>

      <div className="mt-4 grid gap-3">
        {periods.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            暂无排除时间段。
          </p>
        ) : (
          periods.map((period) => (
            <details key={period.id} className="rounded-md bg-slate-50 p-3">
              <summary className="cursor-pointer">
                <span className="font-medium text-slate-900">{period.name}</span>
                <span className="ml-2 text-sm text-slate-500">
                  {period.startDate} 至 {period.endDate}
                </span>
              </summary>
              <div className="mt-3 grid gap-3">
                <p className="text-sm text-slate-600">
                  {period.countAsExcluded ? "计入排除时间" : "暂不计入排除时间"}
                  {period.reason ? ` · ${period.reason}` : ""}
                </p>
                <ExcludedPeriodForm
                  initialValue={{
                    name: period.name,
                    startDate: period.startDate,
                    endDate: period.endDate,
                    reason: period.reason ?? "",
                    countAsExcluded: period.countAsExcluded,
                  }}
                  stage={stage}
                  submitLabel="保存排除时间段"
                  onSubmit={(value) => onUpdate(period, value)}
                />
                <Button
                  title="删除排除时间段"
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`删除排除时间段「${period.name}」？`)) {
                      onDelete(period);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  删除
                </Button>
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}

function MilestoneSection({
  stage,
  milestones,
  onCreate,
  onUpdate,
  onDelete,
}: {
  stage: LifeStage;
  milestones: Milestone[];
  onCreate: (value: MilestoneFormValue) => void;
  onUpdate: (milestone: Milestone, value: MilestoneFormValue) => void;
  onDelete: (milestone: Milestone) => void;
}) {
  return (
    <section className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-slate-950">里程碑</h4>
        <span className="text-sm text-slate-500">{milestones.length} 个</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">把阶段里的关键事件放在时间线上。</p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          添加里程碑
        </summary>
        <div className="mt-3">
          <MilestoneForm stage={stage} submitLabel="添加里程碑" onSubmit={onCreate} />
        </div>
      </details>

      <div className="mt-4 grid gap-3">
        {milestones.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            暂无里程碑。
          </p>
        ) : (
          milestones
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((milestone) => (
              <details key={milestone.id} className="rounded-md bg-slate-50 p-3">
                <summary className="cursor-pointer">
                  <span className="font-medium text-slate-900">{milestone.name}</span>
                  <span className="ml-2 text-sm text-slate-500">{milestone.date}</span>
                </summary>
                <div className="mt-3 grid gap-3">
                  {milestone.description && (
                    <p className="text-sm text-slate-600">{milestone.description}</p>
                  )}
                  {!isDateInStage(milestone.date, stage) && (
                    <p className="text-sm text-amber-700">这个里程碑不在阶段日期内。</p>
                  )}
                  <MilestoneForm
                    initialValue={{
                      name: milestone.name,
                      date: milestone.date,
                      description: milestone.description ?? "",
                    }}
                    stage={stage}
                    submitLabel="保存里程碑"
                    onSubmit={(value) => onUpdate(milestone, value)}
                  />
                  <Button
                    title="删除里程碑"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`删除里程碑「${milestone.name}」？`)) {
                        onDelete(milestone);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    删除
                  </Button>
                </div>
              </details>
            ))
        )}
      </div>
    </section>
  );
}

function EmptyMain() {
  const resetDemoData = useLifeStore((state) => state.resetDemoData);

  return (
    <main className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">还没有时间轴</h1>
      <p className="mx-auto mt-2 max-w-xl text-slate-500">
        你可以新建自己的第一条人生时间轴，也可以先载入示例数据看看人生刻度如何工作。
      </p>
      <div className="mt-5 flex justify-center">
        <Button onClick={resetDemoData}>
          <RotateCcw size={16} />
          载入示例数据
        </Button>
      </div>
    </main>
  );
}

export default function App() {
  const actualNow = useNow(60_000);
  const [activePage, setActivePage] = useState<AppPage>("overview");
  const [scaleViewMode, setScaleViewMode] = useState<ScaleViewMode>("full");
  const [showOverviewScale, setShowOverviewScale] = useState(true);
  const projects = useLifeStore((state) => state.projects);
  const selectedProjectId = useLifeStore((state) => state.selectedProjectId);
  const storageWarning = useLifeStore((state) => state.storageWarning);
  const backendStatus = useLifeStore((state) => state.backendStatus);
  const syncWithBackend = useLifeStore((state) => state.syncWithBackend);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const now = actualNow;

  useEffect(() => {
    void syncWithBackend();
  }, [syncWithBackend]);

  return (
    <div className="min-h-screen bg-[#f7f3ea]">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-medium text-slate-500">lifescale</p>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
              LifeScale · 人生刻度
            </h1>
            <p className="mt-1 text-slate-600">
              一个本地优先的人生阶段、暂停期与里程碑可视化工具。
            </p>
          </div>
          <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
            后端：
            {backendStatus === "synced"
              ? "已同步"
              : backendStatus === "syncing"
                ? "同步中"
                : backendStatus === "unavailable"
                  ? "未连接，使用浏览器本地数据"
                  : "待同步"}
          </div>
        </div>
      </header>

      {selectedProject && (
        <PageNav activePage={activePage} onChange={setActivePage} />
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <ProjectList projects={projects} selectedProjectId={selectedProject?.id} now={now} />
        {selectedProject ? (
          <ProjectDetail
            activePage={activePage}
            actualNow={actualNow}
            now={now}
            onToggleOverviewScale={setShowOverviewScale}
            onScaleViewModeChange={setScaleViewMode}
            project={selectedProject}
            scaleViewMode={scaleViewMode}
            showOverviewScale={showOverviewScale}
          />
        ) : (
          <EmptyMain />
        )}
      </div>

      {storageWarning && (
        <div className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg">
          {storageWarning}
        </div>
      )}
    </div>
  );
}
