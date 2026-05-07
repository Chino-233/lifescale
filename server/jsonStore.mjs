import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const emptyData = {
  version: 1,
  projects: [],
  updatedAt: null,
};

let writeQueue = Promise.resolve();

export function createJsonStore(rootDir) {
  const dataFile = process.env.DATA_FILE
    ? path.resolve(process.env.DATA_FILE)
    : path.join(
        process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data"),
        "lifescale.json"
      );
  const backupFile = `${dataFile}.bak`;
  const legacyFile = path.join(rootDir, ".data", "lifescale-data.json");

  async function ensureDataDir() {
    await mkdir(path.dirname(dataFile), { recursive: true });
  }

  async function fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function migrateLegacyFile() {
    if (await fileExists(dataFile)) {
      return;
    }

    if (!(await fileExists(legacyFile))) {
      return;
    }

    await ensureDataDir();
    await copyFile(legacyFile, dataFile);
  }

  function normalizeData(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.projects)) {
      throw new Error("Invalid LifeScale data");
    }

    return {
      version: 1,
      projects: value.projects,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    };
  }

  async function loadData() {
    await migrateLegacyFile();

    try {
      const raw = await readFile(dataFile, "utf-8");
      return normalizeData(JSON.parse(raw));
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return emptyData;
      }

      throw error;
    }
  }

  async function saveData(nextData) {
    const data = {
      ...normalizeData(nextData),
      updatedAt: new Date().toISOString(),
    };

    writeQueue = writeQueue.then(async () => {
      await ensureDataDir();

      if (await fileExists(dataFile)) {
        await copyFile(dataFile, backupFile);
      }

      const tempFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
      await rename(tempFile, dataFile);
    });

    await writeQueue;
    return data;
  }

  async function getStorageInfo() {
    await migrateLegacyFile();

    let exists = false;
    let size = 0;
    let modifiedAt = null;

    try {
      const fileStat = await stat(dataFile);
      exists = true;
      size = fileStat.size;
      modifiedAt = fileStat.mtime.toISOString();
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }

    return {
      dataFile,
      backupFile,
      exists,
      size,
      modifiedAt,
    };
  }

  return {
    dataFile,
    backupFile,
    emptyData,
    getStorageInfo,
    loadData,
    normalizeData,
    saveData,
  };
}
