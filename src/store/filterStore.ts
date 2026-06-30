import { create } from "zustand";
import strictnessProfiles from "../data/strictnessProfiles.json";
import { defaultSections } from "../lib/defaultRules";
import { generateFilter } from "../lib/filterDsl";
import { loadState, saveState } from "../lib/storage";
import type { CustomHideInput, FilterAction, FilterRule, FilterSection, FilterSettings, Rgba, RuleCondition, StrictnessProfileData } from "../types";

const defaultSettings: FilterSettings = {
  strictness: "Semi-Strict",
  style: "Default",
  author: "台服 PoE2 過濾器製造機",
  version: "0.1.0.tw"
};

function cloneSections() {
  return JSON.parse(JSON.stringify(defaultSections)) as FilterSection[];
}

interface FilterState {
  sections: FilterSection[];
  settings: FilterSettings;
  activeSectionId: string;
  generatedFilter: string;
  saveStatus: string;
  manualEnabledRuleIds: Record<string, boolean>;
  strictnessProfileData: StrictnessProfileData;
  setActiveSection: (id: string) => void;
  toggleRule: (ruleId: string) => void;
  updateRuleFontSize: (ruleId: string, value: number) => void;
  updateRuleColor: (ruleId: string, keyword: "SetTextColor" | "SetBorderColor" | "SetBackgroundColor", value: Rgba) => void;
  updateRuleSound: (ruleId: string, id: number | string, volume: number) => void;
  updateSettings: (settings: Partial<FilterSettings>) => void;
  addCustomHideRule: (input: CustomHideInput) => void;
  applyStrictnessProfileData: (profileData: StrictnessProfileData) => void;
  applyTheme: (themeId: string) => void;
  importState: (payload: unknown) => boolean;
  reset: () => void;
  save: () => Promise<void>;
  load: () => Promise<void>;
}

function buildFilter(sections: FilterSection[], settings: FilterSettings) {
  return generateFilter(sections, settings);
}

function updateRule(sections: FilterSection[], ruleId: string, updater: (rule: FilterRule) => FilterRule): FilterSection[] {
  return sections.map((section) => ({
    ...section,
    rules: section.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule))
  }));
}

function upsertAction(rule: FilterRule, action: FilterAction): FilterRule {
  const actions = rule.actions.filter((existing) => existing.keyword !== action.keyword);
  return { ...rule, actions: [...actions, action] };
}

const defaultStrictnessProfileData = strictnessProfiles as StrictnessProfileData;

function applyStrictnessProfile(
  sections: FilterSection[],
  strictness: FilterSettings["strictness"],
  manualEnabledRuleIds: Record<string, boolean>,
  profileData: StrictnessProfileData
) {
  const disabled = new Set(profileData.strictnesses[strictness]?.disabledRuleIds ?? []);
  return sections.map((section) => ({
    ...section,
    rules: section.rules.map((rule) => {
      if (rule.id === "final-show-unknown" || rule.id.startsWith("custom-hide-")) return { ...rule, enabled: true };
      const profileEnabled = !disabled.has(rule.id);
      return { ...rule, enabled: manualEnabledRuleIds[rule.id] ?? profileEnabled };
    })
  }));
}

function createCustomHideRule(input: CustomHideInput, sequence: number): FilterRule {
  const conditions: RuleCondition[] = [];
  if (input.itemClass) conditions.push({ keyword: "Class", operator: "==", values: [input.itemClass] });
  if (input.rarity) conditions.push({ keyword: "Rarity", operator: "==", values: [input.rarity] });
  if (typeof input.areaLevelMin === "number") conditions.push({ keyword: "AreaLevel", operator: ">=", value: input.areaLevelMin });
  if (typeof input.itemLevelMax === "number") conditions.push({ keyword: "ItemLevel", operator: "<=", value: input.itemLevelMax });
  if (typeof input.qualityMax === "number") conditions.push({ keyword: "Quality", operator: "<=", value: input.qualityMax });
  if (input.identified === "identified") conditions.push({ keyword: "Identified", value: true });
  if (input.identified === "unidentified") conditions.push({ keyword: "Identified", value: false });

  return {
    id: `custom-hide-${Date.now()}-${sequence}`,
    sectionId: "leveling-useful-magic-and-normal-items",
    title: "Custom hide rule",
    directive: "Hide",
    enabled: true,
    tierTag: "$type->customhide $tier->user",
    descriptionTw: "玩家新增的安全隱藏規則。",
    conditions,
    actions: [
      { keyword: "SetFontSize", value: 18 },
      { keyword: "SetTextColor", value: { r: 100, g: 100, b: 100, a: 120 } },
      { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 0 } },
      { keyword: "SetBackgroundColor", value: { r: 0, g: 0, b: 0, a: 0 } },
      { keyword: "DisableDropSound", value: true }
    ],
    priority: 61 - sequence
  };
}

function insertBeforeFinalHide(sections: FilterSection[], rule: FilterRule) {
  return sections.map((section) => {
    if (!section.rules.some((candidate) => candidate.id === "final-hide-known")) return section;
    const nextRules = [...section.rules];
    const finalHideIndex = nextRules.findIndex((candidate) => candidate.id === "final-hide-known");
    nextRules.splice(finalHideIndex < 0 ? nextRules.length : finalHideIndex, 0, rule);
    return { ...section, rules: nextRules };
  });
}

const styleMap = {
  default: "Default",
  contrast: "High Contrast",
  trade: "Taiwan Trade",
  streamer: "Streamer"
} as const;

const themePalettes = {
  default: {
    premium: { text: { r: 255, g: 0, b: 0, a: 255 }, border: { r: 255, g: 0, b: 0, a: 255 }, background: { r: 255, g: 255, b: 255, a: 255 }, sound: 6, beam: "Red" },
    strong: { text: { r: 0, g: 240, b: 190, a: 255 }, border: { r: 0, g: 240, b: 190, a: 255 }, background: { r: 0, g: 75, b: 30, a: 255 }, sound: 3, beam: "Blue" },
    useful: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 255, g: 255, b: 255, a: 255 }, background: { r: 20, g: 20, b: 0, a: 255 }, sound: 2, beam: "Yellow" },
    quiet: { text: { r: 180, g: 180, b: 180, a: 255 }, border: { r: 0, g: 0, b: 0, a: 255 }, background: { r: 20, g: 20, b: 0, a: 180 }, sound: 2, beam: "Grey" },
    hidden: { text: { r: 90, g: 90, b: 90, a: 180 }, border: { r: 0, g: 0, b: 0, a: 0 }, background: { r: 20, g: 20, b: 0, a: 0 }, sound: 1, beam: "Grey" },
    unknown: { text: { r: 0, g: 255, b: 255, a: 255 }, border: { r: 0, g: 255, b: 255, a: 255 }, background: { r: 255, g: 0, b: 255, a: 255 }, sound: 3, beam: "Pink" }
  },
  contrast: {
    premium: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 255, g: 208, b: 79, a: 255 }, background: { r: 0, g: 0, b: 0, a: 255 }, sound: 6, beam: "White" },
    strong: { text: { r: 0, g: 245, b: 255, a: 255 }, border: { r: 0, g: 245, b: 255, a: 255 }, background: { r: 0, g: 20, b: 30, a: 255 }, sound: 3, beam: "Cyan" },
    useful: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 140, g: 190, b: 255, a: 255 }, background: { r: 0, g: 0, b: 0, a: 255 }, sound: 2, beam: "Blue" },
    quiet: { text: { r: 210, g: 210, b: 210, a: 255 }, border: { r: 90, g: 90, b: 90, a: 255 }, background: { r: 0, g: 0, b: 0, a: 210 }, sound: 2, beam: "Grey" },
    hidden: { text: { r: 120, g: 120, b: 120, a: 150 }, border: { r: 0, g: 0, b: 0, a: 0 }, background: { r: 0, g: 0, b: 0, a: 0 }, sound: 1, beam: "Grey" },
    unknown: { text: { r: 0, g: 0, b: 0, a: 255 }, border: { r: 255, g: 255, b: 255, a: 255 }, background: { r: 255, g: 255, b: 0, a: 255 }, sound: 3, beam: "Yellow" }
  },
  trade: {
    premium: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 255, g: 82, b: 122, a: 255 }, background: { r: 88, g: 10, b: 28, a: 255 }, sound: "ShDivine", beam: "Pink" },
    strong: { text: { r: 255, g: 242, b: 210, a: 255 }, border: { r: 255, g: 188, b: 72, a: 255 }, background: { r: 48, g: 25, b: 10, a: 255 }, sound: "ShExalted", beam: "Orange" },
    useful: { text: { r: 235, g: 245, b: 255, a: 255 }, border: { r: 90, g: 190, b: 255, a: 255 }, background: { r: 10, g: 28, b: 42, a: 255 }, sound: 2, beam: "Blue" },
    quiet: { text: { r: 185, g: 190, b: 200, a: 255 }, border: { r: 75, g: 80, b: 88, a: 255 }, background: { r: 12, g: 13, b: 18, a: 210 }, sound: 2, beam: "Grey" },
    hidden: { text: { r: 90, g: 90, b: 95, a: 130 }, border: { r: 0, g: 0, b: 0, a: 0 }, background: { r: 20, g: 20, b: 0, a: 0 }, sound: 1, beam: "Grey" },
    unknown: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 255, g: 0, b: 255, a: 255 }, background: { r: 90, g: 0, b: 90, a: 255 }, sound: 3, beam: "Pink" }
  },
  streamer: {
    premium: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 157, g: 255, b: 106, a: 255 }, background: { r: 10, g: 40, b: 16, a: 255 }, sound: 6, beam: "Green" },
    strong: { text: { r: 255, g: 255, b: 255, a: 255 }, border: { r: 0, g: 220, b: 255, a: 255 }, background: { r: 0, g: 32, b: 40, a: 255 }, sound: 3, beam: "Cyan" },
    useful: { text: { r: 255, g: 250, b: 210, a: 255 }, border: { r: 255, g: 225, b: 90, a: 255 }, background: { r: 45, g: 38, b: 6, a: 255 }, sound: 2, beam: "Yellow" },
    quiet: { text: { r: 210, g: 220, b: 210, a: 255 }, border: { r: 80, g: 105, b: 80, a: 255 }, background: { r: 10, g: 18, b: 14, a: 230 }, sound: 2, beam: "Grey" },
    hidden: { text: { r: 100, g: 110, b: 100, a: 140 }, border: { r: 0, g: 0, b: 0, a: 0 }, background: { r: 0, g: 0, b: 0, a: 0 }, sound: 1, beam: "Grey" },
    unknown: { text: { r: 0, g: 0, b: 0, a: 255 }, border: { r: 255, g: 255, b: 255, a: 255 }, background: { r: 157, g: 255, b: 106, a: 255 }, sound: 3, beam: "Green" }
  }
} as const;

function ruleImportance(rule: FilterRule): keyof typeof themePalettes.default {
  const tag = rule.tierTag ?? "";
  if (rule.id === "final-show-unknown" || tag.includes("anyremaining")) return "unknown";
  if (rule.directive === "Hide" || tag.includes("exhide") || tag.includes("hidelayer")) return "hidden";
  if (tag.includes("%D9") || tag.includes("%D8") || tag.includes("stier") || tag.includes("highest") || tag.includes("t15") || tag.includes("superexotic")) return "premium";
  if (tag.includes("%D7") || tag.includes("%D6") || rule.sectionId === "currency" || rule.sectionId === "special-currency" || rule.sectionId === "normal-waystone-progression") return "strong";
  if (tag.includes("%D5") || tag.includes("%D4") || rule.sectionId === "gems" || rule.sectionId === "jewels" || rule.sectionId === "socketables") return "useful";
  return "quiet";
}

function applyVisualThemeToRule(rule: FilterRule, themeId: keyof typeof themePalettes): FilterRule {
  const palette = themePalettes[themeId][ruleImportance(rule)];
  const fontSize = ruleImportance(rule) === "premium" ? 45 : ruleImportance(rule) === "strong" ? 42 : ruleImportance(rule) === "useful" ? 40 : rule.directive === "Hide" ? 18 : 34;
  const iconSize = ruleImportance(rule) === "premium" ? 0 : ruleImportance(rule) === "strong" ? 1 : 2;
  const base = { ...rule, actions: rule.actions.filter((action) => !["SetTextColor", "SetBorderColor", "SetBackgroundColor", "SetFontSize", "PlayAlertSound", "PlayEffect", "MinimapIcon"].includes(action.keyword)) };
  if (ruleImportance(rule) === "hidden") {
    return upsertAction(upsertAction(upsertAction(upsertAction(base, { keyword: "SetFontSize", value: fontSize }), { keyword: "SetTextColor", value: palette.text }), { keyword: "SetBorderColor", value: palette.border }), { keyword: "SetBackgroundColor", value: palette.background });
  }
  return [
    { keyword: "SetFontSize", value: themeId === "streamer" ? Math.min(45, fontSize + 3) : fontSize },
    { keyword: "SetTextColor", value: palette.text },
    { keyword: "SetBorderColor", value: palette.border },
    { keyword: "SetBackgroundColor", value: palette.background },
    { keyword: "PlayAlertSound", id: palette.sound, volume: themeId === "streamer" ? 300 : 280 },
    { keyword: "PlayEffect", color: palette.beam },
    { keyword: "MinimapIcon", size: iconSize as 0 | 1 | 2, color: palette.beam, shape: ruleImportance(rule) === "premium" ? "Star" : "Diamond" }
  ].reduce((nextRule, action) => upsertAction(nextRule, action as FilterAction), base);
}

export const useFilterStore = create<FilterState>((set, get) => ({
  sections: applyStrictnessProfile(cloneSections(), defaultSettings.strictness, {}, defaultStrictnessProfileData),
  settings: defaultSettings,
  activeSectionId: "gold",
  generatedFilter: buildFilter(applyStrictnessProfile(cloneSections(), defaultSettings.strictness, {}, defaultStrictnessProfileData), defaultSettings),
  saveStatus: "尚未保存",
  manualEnabledRuleIds: {},
  strictnessProfileData: defaultStrictnessProfileData,
  setActiveSection: (id) => set({ activeSectionId: id }),
  toggleRule: (ruleId) => {
    const current = get().sections.flatMap((section) => section.rules).find((rule) => rule.id === ruleId);
    if (!current || current.id === "final-show-unknown") return;
    const nextEnabled = !current.enabled;
    const manualEnabledRuleIds = { ...get().manualEnabledRuleIds, [ruleId]: nextEnabled };
    const sections = updateRule(get().sections, ruleId, (rule) => ({ ...rule, enabled: nextEnabled }));
    set({ sections, manualEnabledRuleIds, generatedFilter: buildFilter(sections, get().settings) });
  },
  updateRuleFontSize: (ruleId, value) => {
    const sections = updateRule(get().sections, ruleId, (rule) => upsertAction(rule, { keyword: "SetFontSize", value }));
    set({ sections, generatedFilter: buildFilter(sections, get().settings) });
  },
  updateRuleColor: (ruleId, keyword, value) => {
    const sections = updateRule(get().sections, ruleId, (rule) => upsertAction(rule, { keyword, value }));
    set({ sections, generatedFilter: buildFilter(sections, get().settings) });
  },
  updateRuleSound: (ruleId, id, volume) => {
    const sections = updateRule(get().sections, ruleId, (rule) => upsertAction(rule, { keyword: "PlayAlertSound", id, volume }));
    set({ sections, generatedFilter: buildFilter(sections, get().settings) });
  },
  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    const sections = partial.strictness ? applyStrictnessProfile(get().sections, settings.strictness, get().manualEnabledRuleIds, get().strictnessProfileData) : get().sections;
    set({ settings, sections, generatedFilter: buildFilter(sections, settings) });
  },
  addCustomHideRule: (input) => {
    const customCount = get().sections.flatMap((section) => section.rules).filter((rule) => rule.id.startsWith("custom-hide-")).length;
    const customRule = createCustomHideRule(input, customCount + 1);
    const sections = insertBeforeFinalHide(get().sections, customRule);
    set({ sections, activeSectionId: "leveling-useful-magic-and-normal-items", generatedFilter: buildFilter(sections, get().settings) });
  },
  applyStrictnessProfileData: (profileData) => {
    const sections = applyStrictnessProfile(get().sections, get().settings.strictness, get().manualEnabledRuleIds, profileData);
    set({ strictnessProfileData: profileData, sections, generatedFilter: buildFilter(sections, get().settings), saveStatus: "已套用嚴格度實測檔" });
  },
  applyTheme: (themeId) => {
    const safeThemeId = (themeId in themePalettes ? themeId : "default") as keyof typeof themePalettes;
    const settings = { ...get().settings, style: styleMap[safeThemeId] };
    const sections = get().sections.map((section) => ({
      ...section,
      rules: section.rules.map((rule) => ({
        ...applyVisualThemeToRule(rule, safeThemeId),
        enabled: rule.enabled
      }))
    }));
    set({ settings, sections, generatedFilter: buildFilter(sections, settings) });
  },
  importState: (payload) => {
    if (!payload || typeof payload !== "object") return false;
    const data = payload as { sections?: FilterSection[]; settings?: FilterSettings; manualEnabledRuleIds?: Record<string, boolean>; strictnessProfileData?: StrictnessProfileData };
    if (!Array.isArray(data.sections) || !data.settings) return false;
    set({
      sections: data.sections,
      settings: data.settings,
      manualEnabledRuleIds: data.manualEnabledRuleIds ?? {},
      strictnessProfileData: data.strictnessProfileData ?? defaultStrictnessProfileData,
      activeSectionId: data.sections[0]?.id ?? "gold",
      generatedFilter: buildFilter(data.sections, data.settings),
      saveStatus: "已匯入設定"
    });
    return true;
  },
  reset: () => {
    const sections = applyStrictnessProfile(cloneSections(), defaultSettings.strictness, {}, defaultStrictnessProfileData);
    set({ sections, settings: defaultSettings, manualEnabledRuleIds: {}, strictnessProfileData: defaultStrictnessProfileData, activeSectionId: "gold", generatedFilter: buildFilter(sections, defaultSettings), saveStatus: "已重設" });
  },
  save: async () => {
    await saveState({ sections: get().sections, settings: get().settings, manualEnabledRuleIds: get().manualEnabledRuleIds, strictnessProfileData: get().strictnessProfileData });
    set({ saveStatus: `已保存 ${new Date().toLocaleTimeString()}` });
  },
  load: async () => {
    const state = await loadState();
    if (!state) {
      set({ saveStatus: "沒有找到本機保存" });
      return;
    }
    const profileData = state.strictnessProfileData ?? defaultStrictnessProfileData;
    const sections = applyStrictnessProfile(state.sections, state.settings.strictness, state.manualEnabledRuleIds ?? {}, profileData);
    set({
      sections,
      settings: state.settings,
      manualEnabledRuleIds: state.manualEnabledRuleIds ?? {},
      strictnessProfileData: profileData,
      activeSectionId: sections[0]?.id ?? "gold",
      generatedFilter: buildFilter(sections, state.settings),
      saveStatus: `已載入 ${new Date(state.updatedAt).toLocaleString()}`
    });
  }
}));
