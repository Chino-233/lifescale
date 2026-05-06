import type { LifeProject } from "../types/life";
import { createDemoProjects } from "./demoData";

export const STORAGE_KEY = "lifescale-progress-v1";
const LEGACY_STORAGE_KEY = "life-phase-progress-v1";

export type StoredLifeData = {
  version: 1;
  projects: LifeProject[];
};

export type LoadLifeDataResult = {
  data: StoredLifeData;
  warning?: string;
};

function emptyData(): StoredLifeData {
  return {
    version: 1,
    projects: [],
  };
}

function hasStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  } catch {
    return false;
  }
}

export function loadLifeData(): LoadLifeDataResult {
  if (!hasStorage()) {
    return {
      data: { version: 1, projects: createDemoProjects() },
      warning: "当前环境无法访问本地存储，数据可能不会被保存。",
    };
  }

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!raw) {
      return {
        data: { version: 1, projects: createDemoProjects() },
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredLifeData>;

    if (parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return {
        data: emptyData(),
        warning: "本地数据版本或结构无法识别，已载入空白数据。",
      };
    }

    return {
      data: {
        version: 1,
        projects: parsed.projects,
      },
    };
  } catch {
    return {
      data: emptyData(),
      warning: "本地存储中的数据无法解析，已安全恢复为空白状态。",
    };
  }
}

export function saveLifeData(data: StoredLifeData): string | undefined {
  if (!hasStorage()) {
    return "当前环境无法访问本地存储，数据可能不会被保存。";
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return undefined;
  } catch {
    return "保存到本地存储时遇到问题，请检查浏览器存储权限或容量。";
  }
}

export function clearLifeData(): string | undefined {
  if (!hasStorage()) {
    return "当前环境无法访问本地存储。";
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return undefined;
  } catch {
    return "清除本地数据时遇到问题。";
  }
}
