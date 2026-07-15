export type CalloutZone =
  | 'auto'
  | 'armhole'
  | 'band'
  | 'strap'
  | 'hook'
  | 'wing'
  | 'fabric'
  | 'padding'
  | 'gripper'
  | 'w_hold'
  | 'vneck'
  | 'coverage'
  | 'u_back'
  | 'spillage';

export type ViewAngle = 'Front' | 'Side' | 'Back' | 'Mood';
export type SideViewVariant = 'SIDE_VIEW_1' | 'SIDE_VIEW_2';
export type FrontViewVariant = 'FRONT_SHOOT' | 'FRONT_PUSH_UP';

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

export type PresetPose = 'side1' | 'side2' | 'back' | 'mood' | 'front' | 'push_up';

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

export interface PoseConfig {
  viewAngle: ViewAngle;
  sideViewVariant?: SideViewVariant;
  frontViewVariant?: FrontViewVariant;
}

export const GOOGLE_SHEET_URL_STORAGE_KEY = 'belle_style_presets_google_sheet_url';

const PRESET_POSE_CONFIG: Record<PresetPose, PoseConfig> = {
  side1: { viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_1' },
  side2: { viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_2' },
  back: { viewAngle: 'Back' },
  mood: { viewAngle: 'Mood' },
  front: { viewAngle: 'Front', frontViewVariant: 'FRONT_SHOOT' },
  push_up: { viewAngle: 'Front', frontViewVariant: 'FRONT_PUSH_UP' },
};

export const PRESET_POSE_LABELS: Record<PresetPose, string> = {
  side1: 'Side View 1',
  side2: 'Side View 2',
  back: 'Back View',
  mood: 'Mood Shot',
  front: 'Front Shoot',
  push_up: 'Front Push-Up',
};

const VALID_ZONES = new Set<string>([
  'auto', 'armhole', 'band', 'strap', 'hook', 'wing',
  'fabric', 'padding', 'gripper', 'w_hold', 'vneck',
  'coverage', 'u_back', 'spillage',
]);

const toCalloutZone = (raw: string, calloutText?: string): CalloutZone => {
  const val = raw.trim().toLowerCase();
  if (val && VALID_ZONES.has(val)) return val as CalloutZone;
  // If empty or "auto", run keyword detection on callout text
  if (!val || val === 'auto') {
    if (!calloutText) return 'auto';
    return detectZoneFromCalloutText(calloutText);
  }
  return 'auto';
};

// Auto-detect zone from callout keywords
const detectZoneFromCalloutText = (text: string): CalloutZone => {
  const lower = text.toLowerCase();
  if (/armhole|underarm|arm[\s-]*hole|rash[\s-]*free/.test(lower)) return 'armhole';
  if (/bottom[\s-]*band|bra[\s-]*band|underbust|elastic[\s-]*free[\s-]*band/.test(lower)) return 'band';
  if (/strap|shoulder[\s-]*strap|spaghetti/.test(lower)) return 'strap';
  if (/hook|closure|3[\s-]*level|adjustable[\s-]*hook/.test(lower)) return 'hook';
  if (/wing|side[\s-]*wing|back[\s-]*smooth|smoothen/.test(lower)) return 'wing';
  if (/cotton|breathabl|fabric|weave|airy|knit|polyamide/.test(lower)) return 'fabric';
  if (/pad|lift|push[\s-]*up|cushion/.test(lower)) return 'padding';
  if (/grip|gripper|anti[\s-]*slip/.test(lower)) return 'gripper';
  if (/w[\s-]*hold|wire[\s-]*free/.test(lower)) return 'w_hold';
  if (/v[\s-]*neck|neckline|v[\s-]*shape/.test(lower)) return 'vneck';
  if (/coverage|full[\s-]*cover/.test(lower)) return 'coverage';
  if (/u[\s-]*back/.test(lower)) return 'u_back';
  if (/spill|bulge|side[\s-]*bulge/.test(lower)) return 'spillage';
  return 'fabric';
};

// Content types from product trackers that should be silently skipped (not reported as errors).
const SILENT_SKIP_POSE_VALUES = new Set([
  'zoom_shot', 'zoom', 'mock_up_shot', 'mockup_shot', 'mock_up', 'mockup',
  'video', 'video_shot', 'reel',
  'a_content', 'aplus', 'a_plus', 'a__content', 'aplusc', 'a_content_feature',
  'features', 'feature', 'main_image',
  'us_vs_them', 'usvsthem', 'comparison',
  'testimonial', 'testimonials',
  'ads', 'ad', 'infographic', 'banner', 'carousel', 'story',
]);

const toPresetPose = (raw: string): PresetPose | null => {
  const val = raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[-./]/g, '_');
  const lookup: Record<string, PresetPose> = {
    // Side View 1
    side1: 'side1', side_view_1: 'side1', side_1: 'side1', sideview1: 'side1',
    side: 'side1', side_view: 'side1',
    // Side View 2
    side2: 'side2', side_view_2: 'side2', side_2: 'side2', sideview2: 'side2',
    // Back
    back: 'back', back_view: 'back', back_shot: 'back',
    // Mood
    mood: 'mood', mood_shot: 'mood', mood_shoot: 'mood', lifestyle: 'mood', lifestyle_shot: 'mood',
    // Front
    front: 'front', front_shoot: 'front', front_view: 'front', front_shot: 'front',
    // Front Push-Up
    push_up: 'push_up', front_push_up: 'push_up', pushup: 'push_up', push_up_shoot: 'push_up',
    front_pushup: 'push_up', pushup_shoot: 'push_up',
  };
  return lookup[val] ?? null;
};

const getFallbackPoseRaw = (row: string[]): string => {
  for (const cell of row) {
    if (toPresetPose(cell)) return cell;
  }
  return '';
};

const STORAGE_KEY = 'belle_style_presets';

export const savePresetsToStorage = (presets: StylePreset[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors in restricted environments
  }
};

export const loadPresetsFromStorage = (): StylePreset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StylePreset[];
  } catch {
    return [];
  }
};

export const saveGoogleSheetUrlToStorage = (url: string): void => {
  try {
    localStorage.setItem(GOOGLE_SHEET_URL_STORAGE_KEY, url);
  } catch {
    // Ignore storage errors in restricted environments
  }
};

export const loadGoogleSheetUrlFromStorage = (): string => {
  try {
    return localStorage.getItem(GOOGLE_SHEET_URL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const removeGoogleSheetUrlFromStorage = (): void => {
  try {
    localStorage.removeItem(GOOGLE_SHEET_URL_STORAGE_KEY);
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

  if (!url.hostname.includes('docs.google.com')) return null;

  const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!sheetId) return null;

  const gid =
    url.hash.match(/gid=([^&]+)/)?.[1] ||
    url.searchParams.get('gid') ||
    '0';

  return { sheetId, gid };
};

export const toGoogleSheetCsvUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

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
    url.searchParams.set('_sync', Date.now().toString());
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
      errors: ['Paste a Google Sheet URL first.'],
      debug: { csvContainsStyle35: false, parsedStyle35Count: 0, styleNames: [] },
    };
  }

  let csvText = '';
  try {
    const csvUrls = toGoogleSheetCsvUrls(sheetUrl);
    for (const url of csvUrls) {
      const response = await fetch(withCacheBuster(url), {
        cache: 'reload',
        redirect: 'follow',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      if (response.ok) {
        csvText = await response.text();
        break;
      }
    }
  } catch {
    throw new Error('Google Sheet sync failed. Publish the sheet to web as CSV or set sharing to "Anyone with the link can view", then sync again.');
  }

  if (!csvText) {
    throw new Error('Google Sheet sync failed. Publish the sheet to web as CSV or set sharing to "Anyone with the link can view".');
  }

  return parseStylePresetsCSV(csvText);
};

const parseCSVRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };

  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim())) rows.push(row);
    row = [];
  };

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      pushField();
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') i++;
      pushRow();
    } else {
      field += ch;
    }
  }

  if (field || row.length > 0) pushRow();
  return rows;
};

const normalizeHeader = (raw: string): string =>
  raw.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '');

const getCell = (row: string[], headerMap: Map<string, number>, keys: string[]): string => {
  for (const key of keys) {
    const idx = headerMap.get(key);
    if (idx !== undefined) return row[idx] ?? '';
  }
  return '';
};

export const parseStylePresetsCSV = (csvText: string): StylePresetSyncResult => {
  const rows = parseCSVRows(csvText);
  const errors: string[] = [];
  const presets: StylePreset[] = [];
  const csvContainsStyle35 = /\b(?:belle\s*)?sb\s*35\b/i.test(csvText);

  if (rows.length === 0) {
    return {
      presets,
      errors: ['Empty CSV file.'],
      debug: { csvContainsStyle35, parsedStyle35Count: 0, styleNames: [] },
    };
  }

  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      (normalized.includes('style') && normalized.includes('imagepose')) ||
      (normalized.includes('stylename') && normalized.includes('pose')) ||
      (normalized.includes('style') && normalized.includes('pose'))
    );
  });
  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  const headerMap = new Map<string, number>();
  headerRow.forEach((cell, index) => headerMap.set(normalizeHeader(cell), index));

  const hasBelleTrackerHeaders = headerMap.has('style') && headerMap.has('imagepose');
  const hasKnownHeaders = headerRowIndex >= 0;
  const dataRows = rows.slice(hasKnownHeaders ? headerRowIndex + 1 : 0);

  // Tracks the last non-empty style name to handle merged cells in Google Sheets.
  // When cells are merged, Google Sheets CSV export only puts the value in the first
  // row of the merge — all other rows in the merge have an empty string.
  let lastSeenStyleName = '';

  dataRows.forEach((row, idx) => {
    if (row[0]?.trim().startsWith('#')) return;

    const [
      legacyStyleName = '', legacyPoseRaw = '',
      legacyHeading = '', legacySubHeading = '',
      legacyC1Text = '', legacyC1ZoneRaw = '',
      legacyC2Text = '', legacyC2ZoneRaw = '',
      legacyC3Text = '', legacyC3ZoneRaw = '',
      legacyC4Text = '', legacyC4ZoneRaw = '',
    ] = row;

    const rawStyleName = hasKnownHeaders
      ? hasBelleTrackerHeaders
        ? getCell(row, headerMap, ['style'])
        : getCell(row, headerMap, ['stylename', 'style', 'name'])
      : legacyStyleName;

    // If style name is empty and the row has other data, carry forward from the previous
    // row's style name — this handles Google Sheets merged cells in CSV export.
    const styleName = rawStyleName.trim()
      ? rawStyleName.trim()
      : (row.some((cell) => cell.trim()) ? lastSeenStyleName : '');

    if (styleName) lastSeenStyleName = styleName;
    const poseRaw = hasKnownHeaders
      ? hasBelleTrackerHeaders
        ? getCell(row, headerMap, ['imagepose'])
        : getCell(row, headerMap, ['pose', 'imagepose'])
      : legacyPoseRaw;
    const fallbackPoseRaw = toPresetPose(poseRaw) ? poseRaw : getFallbackPoseRaw(row);

    const heading = hasKnownHeaders ? getCell(row, headerMap, ['heading']) : legacyHeading;
    const subHeading = hasKnownHeaders ? getCell(row, headerMap, ['subheading']) : legacySubHeading;
    const c1Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ['point1'] : ['c1text', 'point1']) : legacyC1Text;
    const c2Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ['point2'] : ['c2text', 'point2']) : legacyC2Text;
    const c3Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ['point3'] : ['c3text', 'point3']) : legacyC3Text;
    const c4Text = hasKnownHeaders ? getCell(row, headerMap, hasBelleTrackerHeaders ? ['point4'] : ['c4text', 'point4']) : legacyC4Text;
    const c1ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ['c1zone', 'point1zone']) : legacyC1ZoneRaw;
    const c2ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ['c2zone', 'point2zone']) : legacyC2ZoneRaw;
    const c3ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ['c3zone', 'point3zone']) : legacyC3ZoneRaw;
    const c4ZoneRaw = hasKnownHeaders ? getCell(row, headerMap, ['c4zone', 'point4zone']) : legacyC4ZoneRaw;

    if (!styleName.trim()) {
      if (row.some((cell) => cell.trim())) {
        errors.push(`Row ${idx + 2}: Style name is empty — skipped. (pose read as: "${fallbackPoseRaw || poseRaw || 'empty'}")`);
      }
      return;
    }

    const pose = toPresetPose(fallbackPoseRaw);
    if (!pose) {
      const normalizedPoseVal = fallbackPoseRaw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[-./]/g, '_');
      // Only report error for values that look like real pose names but aren't recognized.
      // Known tracker content types (Zoom Shot, Video, A+ Content, etc.) are silently skipped.
      if (fallbackPoseRaw.trim() && !SILENT_SKIP_POSE_VALUES.has(normalizedPoseVal)) {
        errors.push(`Row ${idx + 2}: Unrecognized pose "${fallbackPoseRaw}" for style "${styleName}" — skipped.`);
        console.warn(`[StylePresets] Skipped row ${idx + 2}: style="${styleName}", pose="${fallbackPoseRaw}", row=`, row);
      }
      return;
    }

    console.log(`[StylePresets] Loaded: style="${styleName}", pose="${fallbackPoseRaw}" → ${pose}`);

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
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
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

export const getPresetOptions = (presets: StylePreset[]): Array<{ value: string; label: string }> =>
  presets.map((p) => ({
    value: `${p.styleName}||${p.pose}`,
    label: `${p.styleName} — ${PRESET_POSE_LABELS[p.pose]}`,
  }));

export const findPreset = (
  presets: StylePreset[],
  styleName: string,
  pose: PresetPose
): StylePreset | undefined =>
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

export const getPoseConfig = (pose: PresetPose): PoseConfig => PRESET_POSE_CONFIG[pose];

export const generateSampleCSV = (): string => {
  const header = 'StyleName,Pose,Heading,SubHeading,C1Text,C1Zone,C2Text,C2Zone,C3Text,C3Zone,C4Text,C4Zone';
  const rows = [
    '# ════════════════════════════════════════════════════════════════════════════════',
    '# ZONE AUTO-DETECTION GUIDE — Leave zone columns EMPTY for automatic keyword detection',
    '# ════════════════════════════════════════════════════════════════════════════════',
    '# ',
    '# OPTION 1: ZERO ZONE ENTRY (Recommended — 80% faster) ',
    '# → Leave ALL C*Zone columns EMPTY (just leave blank cells)',
    '# → System auto-detects zones from callout text keywords',
    '# → Examples: "Armhole" → armhole | "Bottom Band" → band | "Breathable" → fabric',
    '# → Works for: armhole, band, strap, hook, wing, fabric, padding, gripper, w_hold, vneck, coverage, u_back, spillage',
    '# ',
    '# OPTION 2: EXPLICIT ZONES (Override when needed)',
    '# → Enter zone name manually only if auto-detection misses it',
    '# → Valid zones: armhole, band, strap, hook, wing, fabric, padding, gripper, w_hold, vneck, coverage, u_back, spillage',
    '# ',
    '# ════════════════════════════════════════════════════════════════════════════════',
    '',
    '# EXAMPLE 1: Auto-Detection (fastest — recommended for most cases)',
    'BELLE SB 38,side1,Elastic-Free Construction,No Digging. No Marks. No Itching.,Elastic-free Armhole / for Rashfree Comfort,,Elastic-free Bottom Band / for Seamless Support,,Seamless Design / Invisible under Outfits,,,',
    'BELLE SB 38,side2,Comfort that feels light,Soft touch. Gentle support.,Breathable Cotton Fabric / for airy comfort all day,,Light Padding gives / Gentle Lift,,Hidden Internal Gripper / for Perfect Fit,,,',
    'BELLE SB 38,back,All Day Sturdy Back Support,Curve-Secure Fit. Stays Put. Always.,U-Back Support / No Ride-Up,,3-Level Adjustable / Hook Closure,,Wide Side Wings / for Back Smoothening,,,',
    'BELLE SB 38,mood,Bonded Finish Elevated Support,Comfort That Supports Every Curve,Full Coverage / with V-Neckline,,W-Hold / Wire-free Support,,Broad Shoulder / Straps,,No Spillage / No Side Bulges,',
    '',
    '# EXAMPLE 2: Explicit Zones (use only when auto-detection doesn\'t match)',
    'DRESSBERRY DB 40,side1,Total Comfort Redefined,Soft. Supportive. All Day.,Elastic-free Armhole,armhole,Flat Bottom Band,band,Seamless Side Panel,fabric,,',
    'DRESSBERRY DB 40,back,Sculpted Back Support,Confidence from Every Angle.,U-Back Design,u_back,3-Hook Adjustable,hook,Smoothening Side Wings,wing,,',
    '',
    '# EXAMPLE 3: Mixed (auto-detect + explicit where needed)',
    'KOMLI KM 25,side1,Soft Romance Premium,Gentle confidence all day.,Elastic-free Armhole,,Padded Cups,padding,Seamless Invisible Design,,,',
  ];
  return [header, ...rows].join('\n');
};
