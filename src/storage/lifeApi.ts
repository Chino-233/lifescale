import type { StoredLifeData } from "./lifeStorage";

const API_PATH = "/api/life-data";
const STORAGE_INFO_PATH = "/api/storage-info";

export type BackendStorageInfo = {
  dataFile: string;
  backupFile: string;
  exists: boolean;
  size: number;
  modifiedAt: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function loadLifeDataFromServer(): Promise<StoredLifeData> {
  return request<StoredLifeData>(API_PATH);
}

export function saveLifeDataToServer(data: StoredLifeData): Promise<StoredLifeData> {
  return request<StoredLifeData>(API_PATH, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function clearLifeDataOnServer(): Promise<StoredLifeData> {
  return request<StoredLifeData>(API_PATH, {
    method: "DELETE",
  });
}

export function loadBackendStorageInfo(): Promise<BackendStorageInfo> {
  return request<BackendStorageInfo>(STORAGE_INFO_PATH);
}
