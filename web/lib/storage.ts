export type WritingRules = {
  avoidTeiru: boolean;
  preferOmouOverKangaeru: boolean;
  avoidExcessiveKanjiCompounds: boolean;
};

export type PurposeTag = "STAR" | "MOTIVATION" | "SKILL" | "RESULT";

export type Chunk = {
  id: string;
  sourceId: string;
  text: string;
  pinned: boolean;
  purposeTags: PurposeTag[];
};

export type Source = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
};

export type Episode = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  linkedChunkIds: string[];
};

export type Question = {
  id: string;
  questionType:
    | "gakuchika"
    | "self_pr"
    | "motivation"
    | "strengths_weaknesses"
    | "future_plan"
    | "job_hunting_axis";
  charLimit: number;
};

export type Company = {
  id: string;
  name: string;
  notes: string;
  linkedSourceIds: string[];
  questions: Question[];
};

export type AppState = {
  sources: Source[];
  chunks: Chunk[];
  profileName: string;
  writingRules: WritingRules;
  episodes: Episode[];
  companies: Company[];
};

const DEFAULT_STATE: AppState = {
  sources: [],
  chunks: [],
  profileName: "",
  writingRules: {
    avoidTeiru: true,
    preferOmouOverKangaeru: true,
    avoidExcessiveKanjiCompounds: true,
  },
  episodes: [],
  companies: [],
};

const DB_NAME = "es-writer-db";
const STORE_NAME = "kv";
const KEY = "state";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getWithIndexedDB(): Promise<AppState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve((req.result as AppState | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setWithIndexedDB(state: AppState): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(state, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState(): Promise<AppState> {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const v = await getWithIndexedDB();
    return v ?? DEFAULT_STATE;
  } catch {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppState) : DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await setWithIndexedDB(state);
  } catch {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}

export function splitChunks(sourceId: string, body: string): Chunk[] {
  return body
    .split(/\n\s*\n/g)
    .map((txt) => txt.trim())
    .filter(Boolean)
    .map((text, idx) => ({
      id: `${sourceId}-c${idx + 1}`,
      sourceId,
      text,
      pinned: false,
      purposeTags: [],
    }));
}
