// Style preset sync: lets a user type a numeric style code (e.g. "68") and pull
// heading/sub-heading/callout copy for that style, per pose, from a synced Google Sheet.
// Ported from the reference stylePresets.ts the user supplied, adapted to this app's
// local types (no external ../types module) and to this app's DeckShotKey pose set.

export type CalloutZone =
  | "auto"
  | "armhole"
  | "band"
  | "strap"
  | "hook"
  | "wing"
  | "fabric"
  | "padding"
  | "gripper"
  | "w_hold"
  | "vneck"
  | "coverage"
  | "u_back"
  | "spillage";

export interface ImageCalloutsContent {
  heading: string;
  subHead: string;
  callout1: string;
  callout2: string;
  callout3: string;
  callout4: string;
  zone1: CalloutZone;
  zone2: CalloutZone;
  zone3: CalloutZone;
  zone4: CalloutZone;
}

// The poses this app's decks use: side1/side2/mood/back plus zoom (5-image deck only).
// "mockup" isn't a deck shot in this app and has no preset content.
export type PresetPose = "side1" | "side2" | "back" | "mood" | "zoom";

export interface StylePreset {
  styleName: string;
  pose: PresetPose;
  heading: string;
  subHeading: string;
  c1Text: string;
  c1Zone: CalloutZone;
  c2Text: string;
  c2Zone: CalloutZone;
  c3Text: string;
  c3Zone: CalloutZone;
  c4Text: string;
  c4Zone: CalloutZone;
}

interface StylePresetParseDebug {
  csvContainsStyle35: boolean;
  parsedStyle35Count: number;
  styleNames: string[];
}

export interface StylePresetSyncResult {
  presets: StylePreset[];
  errors: string[];
  debug: StylePresetParseDebug;
}

export const GOOGLE_SHEET_URL_STORAGE_KEY = "studioflow_style_presets_google_sheet_url";
const STORAGE_KEY = "studioflow_style_presets";

export const PRESET_POSE_LABELS: Record<PresetPose, string> = {
  side1: "Side View 1",
  side2: "Side View 2",
  back: "Back View",
  mood: "Mood Shot",
  zoom: "Zoom Shot",
};

const VALID_ZONES = new Set<string>([
  "auto",
  "armhole",
  "band",
  "strap",
  "hook",
  "wing",
  "fabric",
  "padding",
  "gripper",
  "w_hold",
  "vneck",
  "coverage",
  "u_back",
  "spillage",
]);

const toCalloutZone = (raw: string, calloutText?: string): CalloutZone => {
  const val = raw.trim().toLowerCase();
  if (val && VALID_ZONES.has(val)) return val as CalloutZone;
  if (!val || val === "auto") {
    if (!calloutText) return "auto";
    return detectZoneFromCalloutText(calloutText);
  }
  return "auto";
};

const detectZoneFromCalloutText = (text: string): CalloutZone => {
  const lower = text.toLowerCase();
  if (/armhole|underarm|arm[\s-]*hole|rash[\s-]*free/.test(lower)) return "armhole";
  if (/bottom[\s-]*band|bra[\s-]*band|underbust|elastic[\s-]*free[\s-]*band/.test(lower)) return "band";
  if (/strap|shoulder[\s-]*strap|spaghetti/.test(lower)) return "strap";
  if (/hook|closure|3[\s-]*level|adjustable[\s-]*hook/.test(lower)) return "hook";
  if (/wing|side[\s-]*wing|back[\s-]*smooth|smoothen/.test(lower)) return "wing";
  if (/cotton|breathabl|fabric|weave|airy|knit|polyamide/.test(lower)) return "fabric";
  if (/pad|lift|push[\s-]*up|cushion/.test(lower)) return "padding";
  if (/grip|gripper|anti[\s-]*slip/.test(lower)) return "gripper";
  if (/w[\s-]*hold|wire[\s-]*free/.test(lower)) return "w_hold";
  if (/v[\s-]*neck|neckline|v[\s-]*shape/.test(lower)) return "vneck";
  if (/coverage|full[\s-]*cover/.test(lower)) return "coverage";
  if (/u[\s-]*back/.test(lower)) return "u_back";
  if (/spill|bulge|side[\s-]*bulge/.test(lower)) return "spillage";
  return "fabric";
};

// Content types from product trackers that should be silently skipped (not reported as errors).
const SILENT_SKIP_POSE_VALUES = new Set([
  "mock_up_shot",
  "mockup_shot",
  "mock_up",
  "mockup",
  "video",
  "video_shot",
  "reel",
  "a_content",
  "aplus",
  "a_plus",
  "a__content",
  "aplusc",
  "a_content_feature",
  "features",
  "feature",
  "main_image",
  "us_vs_them",
  "usvsthem",
  "comparison",
  "testimonial",
  "testimonials",
  "ads",
  "ad",
  "infographic",
  "banner",
  "carousel",
  "story",
  "front",
  "front_shoot",
  "front_view",
  "front_shot",
  "push_up",
  "front_push_up",
  "pushup",
  "push_up_shoot",
  "front_pushup",
  "pushup_shoot",
]);

const toPresetPose = (raw: string): PresetPose | null => {
  const val = raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[-./]/g, "_");
  const lookup: Record<string, PresetPose> = {
    side1: "side1",
    side_view_1: "side1",
    side_1: "side1",
    sideview1: "side1",
    side: "side1",
    side_view: "side1",
    side2: "side2",
    side_view_2: "side2",
    side_2: "side2",
    sideview2: "side2",
    back: "back",
    back_view: "back",
    back_shot: "back",
    mood: "mood",
    mood_shot: "mood",
    mood_shoot: "mood",
    lifestyle: "mood",
    lifestyle_shot: "mood",
    zoom: "zoom",
    zoom_shot: "zoom",
    zoom_view: "zoom",
  };
  return lookup[val] ?? null;
};

const getFallbackPoseRaw = (row: string[]): string => {
  for (const cell of row) {
    if (toPresetPose(cell)) return cell;
  }
  return "";
};

export const savePresetsToStorage = (presets: StylePreset[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors in restricted environments
  }
};

export const loadPresetsFromStorage = (): StylePreset[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StylePreset[];
  } catch {
    return [];
  }
};

export const saveGoogleSheetUrlToStorage = (url: string): void => {
  try {
    window.localStorage.setItem(GOOGLE_SHEET_URL_STORAGE_KEY, url);
  } catch {
    // Ignore storage errors in restricted environments
  }
};

export const loadGoogleSheetUrlFromStorage = (): string => {
  try {
    return window.localStorage.getItem(GOOGLE_SHEET_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const removeGoogleSheetUrlFromStorage = (): void => {
  try {
    window.localStorage.removeItem(GOOGLE_SHEET_URL_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
};

const getGoogleSheetUrlParts = (rawUrl: string): { sheetId: string; gid: string } | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!url.hostname.includes("docs.google.com")) return null;

  const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!sheetId) return null;

  const gid = url.hash.match(/gid=([^&]+)/)?.[1] || url.searchParams.get("gid") || "0";

  return { sheetId, gid };
};

export const toGoogleSheetCsvUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  const parts = getGoogleSheetUrlParts(trimmed);
  if (!parts) return trimmed;

  return `https://docs.google.com/spreadsheets/d/${parts.sheetId}/export?format=csv&gid=${encodeURIComponent(parts.gid)}`;
};

const toGoogleSheetCsvUrls = (rawUrl: string): string[] => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  const parts = getGoogleSheetUrlParts(trimmed);
  if (!parts) return [trimmed];

  const gid = encodeURIComponent(parts.gid);
  const sheetId = parts.sheetId;
  return [
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
  ];
};

const withCacheBuster = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("_sync", Date.now().toString());
    return url.toString();
  } catch {
    return rawUrl;
  }
};

export const fetchStylePresetsFromGoogleSheet = async (sheetUrl: string): Promise<StylePresetSyncResult> => {
  const csvUrl = toGoogleSheetCsvUrl(sheetUrl);
  if (!csvUrl) {
    return {
      presets: [],
      errors: ["Paste a Google Sheet URL first."],
      debug: { csvContainsStyle35: false, parsedStyle35Count: 0, styleNames: [] },
    };
  }

  let csvText = "";
  try {
    const csvUrls = toGoogleSheetCsvUrls(sheetUrl);
    for (const url of csvUrls) {
      const response = await fetch(withCacheBuster(url), {
        cache: "reload",
        redirect: "follow",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (response.ok) {
        csvText = await response.text();
        break;
      }
    }
  } catch {
    throw new Error(
      'Google Sheet sync failed. Publish the sheet to web as CSV or set sharing to "Anyone with the link can view", then sync again.',
    );
  }

  if (!csvText) {
    throw new Error(
      'Google Sheet sync failed. Publish the sheet to web as CSV or set sharing to "Anyone with the link can view".',
    );
  }

  return parseStylePresetsCSV(csvText);
};

const parseCSVRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim())) rows.push(row);
    row = [];
  };

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      pushField();
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && csvText[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }

  if (field || row.length > 0) pushRow();
  return rows;
};

const normalizeHeader = (raw: string): string => raw.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "");

const getCell = (row: string[], headerMap: Map<string, number>, keys: string[]): string => {
  for (const key of keys) {
    const idx = headerMap.get(key);
    if (idx !== undefined) return row[idx] ?? "";
  }
  return "";
};

export const parseStylePresetsCSV = (csvText: string): StylePresetSyncResult => {
  const rows = parseCSVRows(csvText);
  const errors: string[] = [];
  const presets: StylePreset[] = [];
  const csvContainsStyle35 = /\b(?:belle\s*)?sb\s*35\b/i.test(csvText);

  if (rows.length === 0) {
    return {
      presets,
      errors: ["Empty CSV file."],
      debug: { csvContainsStyle35, parsedStyle35Count: 0, styleNames: [] },
    };
  }

  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      (normalized.includes("style") && normalized.includes("imagepose")) ||
      (normalized.includes("stylename") && normalized.includes("pose")) ||
      (normalized.includes("style") && normalized.includes("pose"))
    );
  });
  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  const headerMap = new Map<string, number>();
  headerRow.forEach((cell, index) => headerMap.set(normalizeHeader(cell), index));

  const hasBelleTrackerHeaders = headerMap.has("style") && headerMap.has("imagepose");
  const hasKnownHeaders = headerRowIndex >= 0;
  const dataRows = rows.slice(hasKnownHeaders ? headerRowIndex + 1 : 0);

  // Tracks the last non-empty style name to handle merged cells in Google Sheets.
  let lastSeenStyleName = "";

  dataRows.forEach((row, idx) => {
    if (row[0]?.trim().startsWith("#")) return;

    const [
      legacyStyleName = "",
      legacyPoseRaw = "",
      legacyHeading = "",
      legacySubHeading = "",
      legacyC1Text = "",
      legacyC1ZoneRaw = "",
      legacyC2Text = "",
      legacyC2ZoneRaw = "",
      legacyC3Text = "",
      legacyC3ZoneRaw = "",
      legacyC4Text = "",
      legacyC4ZoneRaw = "",
    ] = row;

    const rawStyleName = hasKnownHeaders
      ? hasBelleTrackerHeaders
        ? getCell(row, headerMap, ["style"])
        : getCell(row, headerMap, ["stylename", "style", "name"])
      : legacyStyleName;

    const styleName = rawStyleName.trim()
      ? rawStyleName.trim()
      : row.some((cell) => cell.trim())
        ? lastSeenStyleName
        : "";

    if (styleName) lastSeenStyleName = styleName;
    const poseRaw = hasKnownHeaders
      ? hasBelleTrackerHeaders
        ? getCell(row, headerMap, ["imagepose"])
        : getCell(row, headerMap, ["pose", "imagepose"])
      : legacyPoseRaw;
    const fallbackPoseRaw = toPresetPose(poseRaw) ? poseRaw : getFallbackPoseRaw(row);

    const heading = hasKnownHeaders ? getCell(row, headerMap, ["heading"]) : legacyHeading;
    const subHeading = hasKnownHeaders ? getCell(row, headerMap, ["subheading"]) : legacySubHeading;
    const c1Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ["point1"] : ["c1text", "point1"]) : legacyC1Text;
    const c2Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ["point2"] : ["c2text", "point2"]) : legacyC2Text;
    const c3Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ["point3"] : ["c3text", "point3"]) : legacyC3Text;
    const c4Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ["point4"] : ["c4text", "point4"]) : legacyC4Text;
    const c1ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ["c1zone", "point1zone"]) : legacyC1ZoneRaw;
    const c2ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ["c2zone", "point2zone"]) : legacyC2ZoneRaw;
    const c3ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ["c3zone", "point3zone"]) : legacyC3ZoneRaw;
    const c4ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ["c4zone", "point4zone"]) : legacyC4ZoneRaw;

    if (!styleName.trim()) {
      if (row.some((cell) => cell.trim())) {
        errors.push(`Row ${idx + 2}: Style name is empty — skipped. (pose read as: "${fallbackPoseRaw || poseRaw || "empty"}")`);
      }
      return;
    }

    const pose = toPresetPose(fallbackPoseRaw);
    if (!pose) {
      const normalizedPoseVal = fallbackPoseRaw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[-./]/g, "_");
      if (fallbackPoseRaw.trim() && !SILENT_SKIP_POSE_VALUES.has(normalizedPoseVal)) {
        errors.push(`Row ${idx + 2}: Unrecognized pose "${fallbackPoseRaw}" for style "${styleName}" — skipped.`);
      }
      return;
    }

    presets.push({
      styleName: styleName.trim(),
      pose,
      heading: heading.trim(),
      subHeading: subHeading.trim(),
      c1Text: c1Text.trim(),
      c1Zone: toCalloutZone(c1ZoneRaw, c1Text),
      c2Text: c2Text.trim(),
      c2Zone: toCalloutZone(c2ZoneRaw, c2Text),
      c3Text: c3Text.trim(),
      c3Zone: toCalloutZone(c3ZoneRaw, c3Text),
      c4Text: c4Text.trim(),
      c4Zone: toCalloutZone(c4ZoneRaw, c4Text),
    });
  });

  const styleNames = Array.from(new Set(presets.map((preset) => preset.styleName))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  return {
    presets,
    errors,
    debug: {
      csvContainsStyle35,
      parsedStyle35Count: presets.filter((preset) => /\b35\b/.test(preset.styleName)).length,
      styleNames,
    },
  };
};

/** All distinct style numbers found in a style name, e.g. "BELLE SB 68" -> ["68"]. */
function styleNumbers(styleName: string): string[] {
  return styleName.match(/\d+/g) ?? [];
}

/** Style names whose number matches the search query exactly (e.g. "68" matches "BELLE SB 68"). */
export function searchStylesByNumber(presets: StylePreset[], query: string): string[] {
  const digits = query.trim();
  if (!digits) return [];
  const names = new Set<string>();
  for (const preset of presets) {
    if (styleNumbers(preset.styleName).includes(digits)) names.add(preset.styleName);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

export function isPresetPose(deckShot: string): deckShot is PresetPose {
  return (
    deckShot === "side1" ||
    deckShot === "side2" ||
    deckShot === "back" ||
    deckShot === "mood" ||
    deckShot === "zoom"
  );
}

export const findPreset = (presets: StylePreset[], styleName: string, pose: PresetPose): StylePreset | undefined =>
  presets.find((p) => p.styleName === styleName && p.pose === pose);

export const presetToCalloutsContent = (preset: StylePreset): ImageCalloutsContent => ({
  heading: preset.heading,
  subHead: preset.subHeading,
  callout1: preset.c1Text,
  callout2: preset.c2Text,
  callout3: preset.c3Text,
  callout4: preset.c4Text,
  zone1: preset.c1Zone,
  zone2: preset.c2Zone,
  zone3: preset.c3Zone,
  zone4: preset.c4Zone,
});
