import Editor from "@monaco-editor/react";
import { AlertTriangle, BookOpen, Check, ClipboardPaste, Download, Eye, EyeOff, FileCode2, FlaskConical, Gem, ImageUp, Layers3, Mail, RefreshCcw, Save, Search, Settings2, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import items from "./data/items.tw.json";
import poe2dbTranslations from "./data/poe2dbTranslations.generated.json";
import translations from "./data/translations.json";
import { downloadTextFile } from "./lib/download";
import { simulateItem, validateFilterSyntax } from "./lib/filterDsl";
import { themePresets } from "./lib/defaultRules";
import { useFilterStore } from "./store/filterStore";
import type { CustomHideInput, FilterAction, FilterRule, FilterSection, FilterSettings, ItemRecord, Rgba, ScreenId, SimulationItem, StrictnessProfileData } from "./types";

const itemRecords = items as ItemRecord[];
const classTranslations = translations as Record<string, string>;
const poe2dbNameLookup = (poe2dbTranslations as { translations: Record<string, string>; missing: Array<{ english: string }> }).translations;
const strictnessOrder = ["Soft", "Regular", "Semi-Strict", "Strict", "Very Strict", "Uber Strict", "Uber+1 Strict"] as const;
const itemNameLookup = new Map(itemRecords.map((record) => [record.english, record.tw]));
const itemClassOptions = [
  "Stackable Currency",
  "Waystones",
  "Skill Gems",
  "Support Gems",
  "Jewels",
  "Socketable",
  "Rings",
  "Amulets",
  "Belts",
  "Body Armours",
  "Boots",
  "Gloves",
  "Helmets",
  "Bows",
  "Crossbows",
  "One Hand Maces",
  "Two Hand Maces",
  "Quarterstaves",
  "Wands",
  "Staves",
  "Foci",
  "Shields",
  "Life Flasks",
  "Mana Flasks",
  "Charms"
];

const screens: Array<{ id: ScreenId; label: string; icon: typeof Layers3 }> = [
  { id: "overview", label: "總覽", icon: Layers3 },
  { id: "customize", label: "自訂規則", icon: Settings2 },
  { id: "themes", label: "外觀主題", icon: Sparkles },
  { id: "advanced", label: "進階工具", icon: FileCode2 },
  { id: "export", label: "匯出", icon: Download }
];

const footerLinks: Array<{ id: ScreenId; label: string; icon: typeof ShieldCheck }> = [
  { id: "privacy", label: "隱私權政策", icon: ShieldCheck },
  { id: "guide", label: "使用說明", icon: BookOpen },
  { id: "disclaimer", label: "免責聲明", icon: AlertTriangle },
  { id: "contact", label: "聯絡方式", icon: Mail }
];

const defaultAdsenseClientId = "ca-pub-2601433155827756";
const configuredAdsenseClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim() || defaultAdsenseClientId;

const adsConfig = {
  enabled: import.meta.env.VITE_ENABLE_ADSENSE === "true" || import.meta.env.PROD,
  clientId: configuredAdsenseClientId,
  slots: {
    left: import.meta.env.VITE_AD_SLOT_LEFT?.trim() ?? "",
    right: import.meta.env.VITE_AD_SLOT_RIGHT?.trim() ?? "",
    mobile: import.meta.env.VITE_AD_SLOT_MOBILE?.trim() ?? ""
  }
};

const canLoadAdsense = adsConfig.enabled && adsConfig.clientId.startsWith("ca-pub-");

const strictnessLabels: Record<string, string> = {
  Soft: "寬鬆",
  Regular: "一般",
  "Semi-Strict": "半嚴格",
  Strict: "嚴格",
  "Very Strict": "非常嚴格",
  "Uber Strict": "極嚴格",
  "Uber+1 Strict": "終極嚴格"
};

const strictnessFileAliases: Record<string, FilterSettings["strictness"]> = {
  soft: "Soft",
  regular: "Regular",
  semistrict: "Semi-Strict",
  "semi-strict": "Semi-Strict",
  strict: "Strict",
  verystrict: "Very Strict",
  "very-strict": "Very Strict",
  uberstrict: "Uber Strict",
  "uber-strict": "Uber Strict",
  uberplusstrict: "Uber+1 Strict",
  "uber-plus-strict": "Uber+1 Strict",
  uber1strict: "Uber+1 Strict",
  "uber-1-strict": "Uber+1 Strict"
};

function normalizeStrictnessKey(value: string) {
  return value.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function strictnessFromFileName(fileName: string): FilterSettings["strictness"] | undefined {
  const key = normalizeStrictnessKey(fileName.replace(/\.filter$/i, ""));
  return Object.entries(strictnessFileAliases).find(([alias]) => key.includes(alias))?.[1];
}

function ruleFingerprintFromHeader(header: string) {
  return header.replace(/\s+/g, " ").trim();
}

function ruleFingerprint(rule: FilterRule) {
  return ruleFingerprintFromHeader(`${rule.directive} # ${rule.tierTag ?? ""}`);
}

function parseFilterRuleHeaders(text: string) {
  return new Set(
    text
      .split(/\r?\n/)
      .filter((line) => /^(Show|Hide)\b/.test(line.trim()))
      .map((line) => ruleFingerprintFromHeader(line.trim()))
  );
}

async function buildProfileFromFilterFiles(files: File[], baselineSections: FilterSection[]): Promise<StrictnessProfileData> {
  const baselineRules = baselineSections.flatMap((section) => section.rules).filter((rule) => !rule.id.startsWith("custom-hide-"));
  const profiles = {} as StrictnessProfileData["strictnesses"];
  for (const file of files) {
    const strictness = strictnessFromFileName(file.name);
    if (!strictness) continue;
    const text = await file.text();
    const headerSet = parseFilterRuleHeaders(text);
    const disabledRuleIds = baselineRules.filter((rule) => rule.id !== "final-show-unknown" && !headerSet.has(ruleFingerprint(rule))).map((rule) => rule.id);
    profiles[strictness] = {
      name: strictness,
      sourceFile: file.name,
      ruleCount: headerSet.size,
      matchedRuleCount: baselineRules.length - disabledRuleIds.length,
      disabledRuleIds
    };
  }

  for (const strictness of strictnessOrder) {
    if (!profiles[strictness]) throw new Error(`缺少 ${strictnessLabels[strictness]} 的 FilterBlade 檔案`);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "手動匯入 FilterBlade PoE2 實測檔案",
    sourceUrl: "https://www.filterblade.xyz/?game=Poe2",
    baseline: profiles["Semi-Strict"].sourceFile,
    strictnesses: profiles
  };
}

const styleLabels: Record<string, string> = {
  Default: "預設",
  "High Contrast": "高對比",
  "Taiwan Trade": "台服交易",
  Streamer: "直播模式"
};

const rarityLabels: Record<string, string> = {
  Normal: "普通",
  Magic: "魔法",
  Rare: "稀有",
  Unique: "傳奇"
};

const ruleTitleTw: Record<string, string> = {
  "uniques-4": "兩次汙染傳奇",
  "uniques-5": "瓦爾詞綴傳奇",
  "uniques-7": "高品質傳奇",
  "gold-stack-5000": "大量金幣",
  "gold-stack-650": "中量金幣",
  "exotic-chancing": "機會石基底",
  "exceptional-overquality": "高品質與多洞物品",
  "hide-normal-magic-endgame": "隱藏低價終局裝備",
  "rare-unidentified-tier-4": "高階未鑑定稀有裝備",
  "socketable-runes": "符文與可鑲嵌物",
  "time-lost-jewels": "失落時間珠寶",
  "relic-catcher": "聖物提示",
  "uncut-skill-gem-19": "高等級未切割寶石",
  "waystone-decorator-15": "高階換界石外觀標記",
  "waystone-tier-15": "高階換界石",
  "currency-s-tier": "頂級通貨",
  "currency-b-tier": "實用通貨",
  "special-essences": "精髓與催化劑",
  "unique-tier-one": "高價傳奇物品",
  "breach-splinter-stack": "裂片堆疊",
  "leveling-magic-decorator": "拓荒魔法裝備外觀標記",
  "leveling-magic-remaining": "拓荒魔法裝備",
  "final-hide-known": "隱藏已知低價物品",
  "final-show-unknown": "未知物品安全高亮"
};

const sectionTitleTw: Record<string, string> = {
  gold: "金幣",
  "exotic-bases": "特殊基底",
  "exceptional-items": "例外高價物品",
  "identified-mods-recombinator-mods": "已鑑定詞綴：重組器詞綴",
  "rare-item-decorators": "稀有裝備標記",
  hiding: "普通、魔法、稀有隱藏規則",
  "economy-crafting-bases": "經濟工藝基底",
  "high-unidentified-mod-tier": "高階未鑑定詞綴",
  "endgame-flasks": "終局藥劑",
  "endgame-charms": "終局護符",
  "normal-and-magic-items-endgame": "終局普通與魔法物品",
  "hide-layer-1-normal-and-magic-endgame-gear": "隱藏層 1：終局普通與魔法裝備",
  "endgame-rare-jewellery": "終局稀有飾品",
  "endgame-rare-gear": "終局稀有裝備",
  "untiered-rare-catcher": "未分級稀有裝備捕捉",
  "hide-layer-2-rare-gear": "隱藏層 2：稀有裝備",
  "new-league-unknown-items": "新聯盟未知物品",
  socketables: "符文與靈魂核心",
  jewels: "珠寶",
  relics: "聖物",
  gems: "寶石與未切割寶石",
  "normal-waystone-progression": "換界石",
  "currency-exceptions-leveling-currencies": "通貨例外：拓荒通貨",
  currency: "通貨分級",
  "special-currency": "特殊通貨",
  "misc-map-like": "其他地圖類物品",
  uniques: "傳奇物品",
  fragments: "裂片、碑牌與碎片",
  "misc-map-items": "其他地圖物品",
  "remaining-currency": "其他通貨",
  "leveling-salvagable": "拓荒可拆裝備",
  "leveling-hide-outdated-leveling-flasks": "拓荒：隱藏過時藥劑",
  "leveling-life-mana-flasks": "拓荒生命與魔力藥劑",
  "leveling-rules": "拓荒規則",
  "leveling-useful-magic-and-normal-items": "拓荒可用普通與魔法物品"
};

const itemNameTw: Record<string, string> = {
  Gold: "金幣",
  "Divine Orb": "神聖石",
  "Mirror of Kalandra": "卡蘭德的魔鏡",
  "Perfect Jeweller's Orb": "完美工匠石",
  "Uncut Skill Gem": "未切割技能寶石",
  "Uncut Spirit Gem": "未切割精神寶石",
  "Uncut Support Gem": "未切割輔助寶石",
  Waystone: "換界石",
  Emerald: "翠綠珠寶",
  Ruby: "赤紅珠寶",
  Sapphire: "鈷藍珠寶",
  "Time-Lost Emerald": "失落翠綠珠寶",
  "Time-Lost Ruby": "失落赤紅珠寶",
  "Time-Lost Sapphire": "失落鈷藍珠寶",
  "Heavy Belt": "重革腰帶",
  "Gold Ring": "金光戒指",
  "Breach Splinter": "裂痕裂片",
  "Skill Gems": "技能寶石",
  "Support Gems": "輔助寶石",
  "Stackable Currency": "可堆疊通貨",
  Jewels: "珠寶",
  Relics: "聖物",
  Normal: "普通",
  Magic: "魔法",
  Rare: "稀有",
  Unique: "傳奇"
};

const classNameTw: Record<string, string> = {
  Amulets: "項鍊",
  Belts: "腰帶",
  "Body Armours": "胸甲",
  Boots: "鞋子",
  Bows: "弓",
  Bucklers: "小盾",
  Charms: "護符",
  Crossbows: "十字弓",
  Foci: "法器",
  Gloves: "手套",
  Helmets: "頭盔",
  Jewels: "珠寶",
  "Life Flasks": "生命藥劑",
  "Mana Flasks": "魔力藥劑",
  "One Hand Maces": "單手錘",
  Quarterstaves: "長杖",
  Quivers: "箭袋",
  Rings: "戒指",
  Sceptres: "權杖",
  Shields: "盾牌",
  Spears: "矛",
  Staves: "法杖",
  Talismans: "符咒",
  "Two Hand Maces": "雙手錘",
  Wands: "魔杖",
  Waystones: "換界石",
  "Skill Gems": "技能寶石",
  "Support Gems": "輔助寶石",
  "Stackable Currency": "可堆疊通貨",
  "Quest Items": "任務物品",
  "Instance Local Items": "區域限定物品"
};

const sectionRuleFallbacks: Record<string, string> = {
  "identified-mods-recombinator-mods": "已鑑定高價詞綴",
  "rare-item-decorators": "稀有裝備標記",
  "economy-crafting-bases": "經濟工藝基底",
  "high-unidentified-mod-tier": "高階未鑑定裝備",
  "endgame-flasks": "終局藥劑",
  "endgame-charms": "終局護符",
  "normal-and-magic-items-endgame": "終局普通與魔法裝備",
  "endgame-rare-jewellery": "終局稀有飾品",
  "endgame-rare-gear": "終局稀有裝備",
  "untiered-rare-catcher": "未分級稀有裝備",
  "new-league-unknown-items": "新聯盟未知物品",
  "leveling-salvagable": "拓荒可拆裝備",
  "leveling-rules": "拓荒規則",
  "leveling-useful-magic-and-normal-items": "拓荒可用裝備"
};

const themeNameTw: Record<string, string> = {
  default: "預設高亮",
  contrast: "高對比",
  trade: "台服交易",
  streamer: "直播模式"
};

const sectionVisuals: Record<string, { icon: string; note: string }> = {
  gold: { icon: "/icons/gold-poe2db.webp", note: "金幣堆與掉落顯示" },
  "exotic-bases": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Belts/Basetypes/Belt09.webp", note: "高價傳奇基底，例如重革腰帶、金光戒指" },
  "exceptional-items": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Belts/Uniques/Headhunter.webp", note: "例外高價物品與超品質裝備" },
  "identified-mods-recombinator-mods": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyAddModToRare.webp", note: "已鑑定高價詞綴" },
  "rare-item-decorators": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyAddModToRare.webp", note: "稀有裝備外觀標記" },
  hiding: { icon: "https://cdn.poe2db.tw/image/Art/2DArt/minimap/player/RareMonsterAlive.webp", note: "普通、魔法、稀有低價裝備隱藏" },
  "economy-crafting-bases": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Belts/Basetypes/Belt09.webp", note: "可交易或可工藝基底" },
  "high-unidentified-mod-tier": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Armours/Helmets/Basetypes/HelmetInt08.webp", note: "高階未鑑定詞綴裝備" },
  "endgame-flasks": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Flasks/Basetypes/FlaskLife09.webp", note: "終局藥劑" },
  "endgame-charms": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Charms/Basetypes/SilverCharm.webp", note: "終局護符" },
  "normal-and-magic-items-endgame": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06.webp", note: "終局普通與魔法物品" },
  "hide-layer-1-normal-and-magic-endgame-gear": { icon: "https://cdn.poe2db.tw/image/Art/2DArt/minimap/player/RareMonsterAlive.webp", note: "終局普通與魔法裝備隱藏層" },
  "endgame-rare-jewellery": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Rings/Basetypes/GoldRing.webp", note: "終局稀有飾品" },
  "endgame-rare-gear": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06.webp", note: "終局稀有裝備" },
  "untiered-rare-catcher": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Armours/Helmets/Basetypes/HelmetInt08.webp", note: "未分級稀有裝備捕捉" },
  "hide-layer-2-rare-gear": { icon: "https://cdn.poe2db.tw/image/Art/2DArt/minimap/player/RareMonsterAlive.webp", note: "稀有裝備隱藏層" },
  "new-league-unknown-items": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyDuplicate.webp", note: "新聯盟未知物品保護" },
  socketables: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Gems/New/ExpeditionRunewordHazardGem.webp", note: "符文與靈魂核心" },
  jewels: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Jewels/EmeraldJewel.webp", note: "翠綠、赤紅、鈷藍珠寶" },
  relics: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Relics/RelicBase1x4.webp", note: "聖物" },
  gems: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Gems/UncutSkillGem.webp", note: "高等與低等未切割寶石" },
  "normal-waystone-progression": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Maps/EndgameMaps/EndgameMap15.webp", note: "換界石階級進程" },
  "currency-exceptions-leveling-currencies": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyUpgradeToRare.webp", note: "拓荒通貨例外" },
  currency: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyModValues.webp", note: "神聖石、魔鏡、完美通貨等高價通貨分級" },
  "special-currency": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/Essence/RarityResistanceEssence.webp", note: "精髓、命運、特殊製作通貨" },
  "misc-map-like": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/PrecursorTablets/PrecursorTabletBreach.webp", note: "其他地圖類物品" },
  uniques: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Belts/Uniques/Headhunter.webp", note: "傳奇物品分級" },
  fragments: { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/Breach/BreachstoneSplinter.webp", note: "裂片、碑牌與碎片" },
  "misc-map-items": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/PrecursorTablets/PrecursorTabletBoss.webp", note: "其他地圖物品" },
  "remaining-currency": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Currency/CurrencyAddModToRare.webp", note: "其他通貨保留" },
  "leveling-salvagable": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Armours/BodyArmours/Basetypes/BodyStrDex6.webp", note: "拓荒可拆裝備" },
  "leveling-hide-outdated-leveling-flasks": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Flasks/Basetypes/FlaskLife09.webp", note: "隱藏過時拓荒藥劑" },
  "leveling-life-mana-flasks": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Flasks/Basetypes/FlaskMana09.webp", note: "拓荒生命與魔力藥劑" },
  "leveling-rules": { icon: "https://cdn.poe2db.tw/image/Art/2DArt/minimap/player/Strongbox.webp", note: "拓荒通用規則" },
  "leveling-useful-magic-and-normal-items": { icon: "https://cdn.poe2db.tw/image/Art/2DItems/Weapons/TwoHandWeapons/Bows/Basetypes/Bow06.webp", note: "拓荒可用普通與魔法裝備" }
};

const overviewFallbackIcons = [
  "/icons/gold-poe2db.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Belts/Basetypes/Belt09.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Maps/EndgameMaps/EndgameMap15.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Jewels/EmeraldJewel.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Gems/UncutSkillGem.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Currency/PrecursorTablets/PrecursorTabletGeneric.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Currency/Essence/RarityResistanceEssence.webp",
  "https://cdn.poe2db.tw/image/Art/2DItems/Currency/Breach/BreachstoneSplinter.webp"
];

const strictnessRank: Record<string, number> = {
  Soft: 0,
  Regular: 1,
  "Semi-Strict": 2,
  Strict: 3,
  "Very Strict": 4,
  "Uber Strict": 5,
  "Uber+1 Strict": 6
};

const ruleHiddenAt: Record<string, number> = {
  "gold-stack-650": 5,
  "currency-b-tier": 5,
  "breach-splinter-stack": 4,
  "leveling-magic-decorator": 3,
  "leveling-magic-remaining": 3,
  "hide-normal-magic-endgame": 2,
  "final-hide-known": 1
};

function translateItemName(value: string) {
  return poe2dbNameLookup[value] ?? itemNameLookup.get(value) ?? itemNameTw[value] ?? classTranslations[value] ?? classNameTw[value] ?? value;
}

function isTranslated(value: string) {
  return value in poe2dbNameLookup || itemNameLookup.has(value) || value in itemNameTw || value in classTranslations || value in classNameTw;
}

function tierLabel(rule: FilterRule) {
  const tag = rule.tierTag ?? "";
  if (tag.includes("%D9") || tag.includes("stier") || tag.includes("superexotic")) return "頂級";
  if (tag.includes("%D8")) return "極高價";
  if (tag.includes("%D7")) return "高價";
  if (tag.includes("%D6")) return "重要";
  if (tag.includes("%D5")) return "實用";
  if (tag.includes("%D4")) return "保留";
  if (tag.includes("%D3")) return "普通";
  if (tag.includes("exhide") || tag.includes("hidelayer")) return "隱藏層";
  if (tag.includes("decorator")) return "外觀標記";
  return "";
}

function compactLabel(values: string[], fallback: string) {
  const translated = values.filter(isTranslated).slice(0, 2).map(translateItemName);
  if (translated.length > 0) return `${translated.join("、")}${values.length > translated.length ? " 等" : ""}`;
  return values.length > 0 ? fallback : "";
}

function getRuleTitle(rule: FilterRule, compact = false) {
  if (ruleTitleTw[rule.id]) return ruleTitleTw[rule.id];
  const valueConditions = rule.conditions.filter((condition): condition is Extract<FilterRule["conditions"][number], { values: string[] }> => "values" in condition);
  const numberConditions = rule.conditions.filter((condition): condition is Extract<FilterRule["conditions"][number], { value: number }> => "value" in condition && typeof condition.value === "number");
  const bases = valueConditions.filter((condition) => condition.keyword === "BaseType").flatMap((condition) => condition.values);
  const classes = valueConditions.filter((condition) => condition.keyword === "Class").flatMap((condition) => condition.values);
  const rarity = valueConditions.filter((condition) => condition.keyword === "Rarity").flatMap((condition) => condition.values);
  const gemLevel = numberConditions.find((condition) => condition.keyword === "GemLevel")?.value;
  const waystoneTier = numberConditions.find((condition) => condition.keyword === "WaystoneTier")?.value;
  const unidentifiedTier = numberConditions.find((condition) => condition.keyword === "UnidentifiedItemTier")?.value;
  const stackSize = numberConditions.find((condition) => condition.keyword === "StackSize")?.value;
  const sectionFallback = sectionRuleFallbacks[rule.sectionId] ?? sectionTitleTw[rule.sectionId] ?? "規則";
  const tier = tierLabel(rule);
  const label = (values: string[], fallback = sectionFallback) => compactLabel(values, fallback);

  if (bases.includes("Gold")) return typeof stackSize === "number" ? `金幣堆 ${stackSize}+` : "金幣堆";
  if (rule.sectionId === "gems") {
    const gemName = bases.includes("Uncut Skill Gem") ? "未切割技能寶石" : bases.includes("Uncut Spirit Gem") ? "未切割精神寶石" : bases.includes("Uncut Support Gem") ? "未切割輔助寶石" : label(classes) || "寶石";
    return typeof gemLevel === "number" ? `${gemName} Lv${gemLevel}${rule.tierTag?.includes("progression") ? " 進程保留" : ""}` : `${gemName}分級`;
  }
  if (rule.sectionId === "normal-waystone-progression") return typeof waystoneTier === "number" ? `換界石 T${waystoneTier}` : "換界石規則";
  if (rule.sectionId === "currency" || rule.sectionId === "special-currency" || rule.sectionId === "currency-exceptions-leveling-currencies") return label(bases, "通貨") ? `通貨：${label(bases, "通貨")}` : "通貨規則";
  if (rule.sectionId === "exotic-bases") return `${tier || "高價"}特殊基底`;
  if (rule.sectionId === "economy-crafting-bases") return `${sectionFallback}${tier ? `：${tier}` : ""}`;
  if (rule.sectionId === "high-unidentified-mod-tier") return `${sectionFallback}${typeof unidentifiedTier === "number" ? ` T${unidentifiedTier}+` : ""}`;
  if (rule.sectionId.includes("hiding") || rule.sectionId.includes("hide-layer")) return `${label(rarity, "低價")}裝備隱藏`;
  if (compact && sectionRuleFallbacks[rule.sectionId]) return `${sectionFallback}${tier ? `：${tier}` : ""}`;
  if (label(classes, "")) return `${label(classes, sectionFallback)}${tier ? `：${tier}` : ""}`;
  if (label(bases, "")) return `${label(bases, sectionFallback)}${tier ? `：${tier}` : ""}`;
  if (sectionRuleFallbacks[rule.sectionId]) return `${sectionFallback}${tier ? `：${tier}` : ""}`;
  return rule.title.replace(/\?+/g, sectionTitleTw[rule.sectionId] ?? "規則");
}

function getRuleDescription(rule: FilterRule) {
  if (rule.descriptionTw && !rule.descriptionTw.includes("?")) return rule.descriptionTw;
  const parts = [rule.directive === "Hide" ? "隱藏符合條件的掉落。" : "顯示符合條件的掉落。"];
  if (rule.sectionId === "gems") parts.push("包含高等與低等未切割寶石進程規則。");
  if (rule.sectionId === "exotic-bases") parts.push("多半是可變成高價傳奇的基底，例如重革腰帶、金光戒指等。");
  if (rule.sectionId === "currency" || rule.sectionId === "special-currency") parts.push("依通貨價值與用途分級，不會把神聖石當成所有通貨的說明。");
  if (rule.id === "final-show-unknown") parts.push("最後兜底，避免未知新物品被誤藏。");
  return parts.join("");
}

function playAlertSound(id: number | string, volume: number) {
  const safeId = String(id || "1").replace(/[^A-Za-z0-9]/g, "");
  const audio = new Audio(`/sounds/AlertSound${safeId}.mp3`);
  audio.volume = Math.max(0, Math.min(1, volume / 300));
  void audio.play();
}

type ColorAction = { keyword: "SetTextColor" | "SetBorderColor" | "SetBackgroundColor"; value: Rgba };
type SizeAction = { keyword: "SetFontSize"; value: number };
type SoundAction = { keyword: "PlayAlertSound"; id: number | string; volume: number };
type CustomSoundAction = { keyword: "CustomAlertSound"; fileName: string; volume: number };

const soundOptions = [
  ["1", "1 - 預設提示 1"],
  ["2", "2 - 預設提示 2"],
  ["3", "3 - 預設提示 3"],
  ["4", "4 - 地圖 / 異界"],
  ["5", "5 - 高階地圖"],
  ["6", "6 - 超高價"],
  ["7", "7 - 預設提示 7"],
  ["8", "8 - 預設提示 8"],
  ["9", "9 - 預設提示 9"],
  ["10", "10 - 新音效"],
  ["11", "11 - 新音效"],
  ["12", "12 - 新音效"],
  ["13", "13 - 新音效"],
  ["14", "14 - 新音效"],
  ["15", "15 - 新音效"],
  ["16", "16 - 新音效"],
  ["ShAlchemy", "鍊金石"],
  ["ShBlessed", "祝福石"],
  ["ShChaos", "混沌石"],
  ["ShFusing", "鏈結石"],
  ["ShGeneral", "強力通用"],
  ["ShRegal", "富豪石"],
  ["ShVaal", "瓦爾石"],
  ["ShDivine", "神聖石"],
  ["ShExalted", "崇高石"],
  ["ShMirror", "卡蘭德的魔鏡"]
] as const;

function rgbaToCss(rgba?: Rgba) {
  if (!rgba) return "transparent";
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a / 255})`;
}

function findAction(rule: FilterRule, keyword: FilterAction["keyword"]) {
  return rule.actions.find((action) => action.keyword === keyword);
}

function RulePreview({ rule, muted = false, compact = false, label }: { rule: FilterRule; muted?: boolean; compact?: boolean; label?: string }) {
  const text = findAction(rule, "SetTextColor") as ColorAction | undefined;
  const border = findAction(rule, "SetBorderColor") as ColorAction | undefined;
  const background = findAction(rule, "SetBackgroundColor") as ColorAction | undefined;
  const sizeAction = findAction(rule, "SetFontSize") as SizeAction | undefined;
  const size = sizeAction?.value ?? 36;
  const displaySize = compact ? Math.max(14, Math.min(size, 20)) : Math.max(18, Math.min(size, 38));
  return (
    <div
      className={`loot-preview ${compact ? "compact" : ""} ${rule.directive === "Hide" ? "hidden-preview" : ""}`}
      style={{
        color: text ? rgbaToCss(text.value) : "#edf1f4",
        borderColor: border ? rgbaToCss(border.value) : "#46515e",
        background: background ? rgbaToCss(background.value) : "#11161c",
        fontSize: `${displaySize}px`
      }}
    >
      <span className={muted ? "preview-crossed" : ""}>{label ?? getRuleTitle(rule, compact)}</span>
    </div>
  );
}

function StrictnessSlider({ compact = false }: { compact?: boolean }) {
  const settings = useFilterStore((state) => state.settings);
  const updateSettings = useFilterStore((state) => state.updateSettings);
  return (
    <div className={`strictness-control ${compact ? "compact" : ""}`}>
      <div className="slider-title">
        <span>嚴格度</span>
        <strong>{strictnessLabels[settings.strictness]}</strong>
      </div>
      <div className="strictness-segments" role="group" aria-label="嚴格度">
        {strictnessOrder.map((value) => (
          <button
            key={value}
            type="button"
            className={value === settings.strictness ? "current" : ""}
            onClick={() => updateSettings({ strictness: value })}
          >
            {strictnessLabels[value]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdsenseLoader() {
  useEffect(() => {
    const existingScript = document.querySelector(
      `script[data-adsense-client="${adsConfig.clientId}"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"][src*="${adsConfig.clientId}"]`
    );
    if (!canLoadAdsense || existingScript) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.clientId)}`;
    script.dataset.adsenseClient = adsConfig.clientId;
    document.head.appendChild(script);
  }, []);

  return null;
}

function AdSlot({ placement, label }: { placement: "left" | "right" | "mobile"; label: string }) {
  const slot = adsConfig.slots[placement];
  useEffect(() => {
    if (!canLoadAdsense || !slot) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle || []).push({});
    } catch {
      // AdSense may be blocked by browser extensions; the placeholder remains usable.
    }
  }, [slot]);

  if (!canLoadAdsense || !slot) {
    return (
      <aside className={`ad-slot ad-slot-${placement}`} aria-label={label}>
        <span>廣告預留</span>
      </aside>
    );
  }

  return (
    <aside className={`ad-slot ad-slot-${placement}`} aria-label={label}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adsConfig.clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

function Overview({ onOpenSection }: { onOpenSection: (sectionId: string) => void }) {
  const sections = useFilterStore((state) => state.sections);
  const settings = useFilterStore((state) => state.settings);
  return (
    <section className="view">
      <div className="view-header">
        <div>
          <h1>台服 PoE2 過濾器製造機</h1>
          <p>依照目前嚴格度預覽掉落顯示。點分類可以直接調整。</p>
        </div>
        <div className="status-grid">
          <div><strong>{strictnessLabels[settings.strictness]}</strong><span>目前嚴格度</span></div>
          <div><strong>{styleLabels[settings.style]}</strong><span>外觀主題</span></div>
          <div><strong>FilterBlade</strong><span>實測來源</span></div>
        </div>
      </div>
      <StrictnessSlider />
      <div className="overview-grid">
        {sections.map((section, index) => (
          <button key={section.id} className="section-card section-card-button" onClick={() => onOpenSection(section.id)}>
            <div className="section-card-head">
              <img
                src={sectionVisuals[section.id]?.icon}
                alt={sectionVisuals[section.id]?.note ?? sectionTitleTw[section.id] ?? section.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = overviewFallbackIcons[index % overviewFallbackIcons.length];
                }}
              />
              <div>
                <h2>{sectionTitleTw[section.id] ?? section.titleTw}</h2>
                <p>{sectionVisuals[section.id]?.note ?? "物品分類"}</p>
              </div>
            </div>
            <div className="preview-stack">
              {section.rules.slice(0, 4).map((rule) => (
                <RulePreview key={rule.id} rule={rule} compact muted={!rule.enabled || rule.directive === "Hide"} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Customize() {
  const sections = useFilterStore((state) => state.sections);
  const activeSectionId = useFilterStore((state) => state.activeSectionId);
  const setActiveSection = useFilterStore((state) => state.setActiveSection);
  const toggleRule = useFilterStore((state) => state.toggleRule);
  const updateRuleFontSize = useFilterStore((state) => state.updateRuleFontSize);
  const updateRuleColor = useFilterStore((state) => state.updateRuleColor);
  const updateRuleSound = useFilterStore((state) => state.updateRuleSound);
  const updateRuleCustomSound = useFilterStore((state) => state.updateRuleCustomSound);
  const addCustomHideRule = useFilterStore((state) => state.addCustomHideRule);
  const [query, setQuery] = useState("");
  const [customSoundUrls, setCustomSoundUrls] = useState<Record<string, string>>({});
  const [customHide, setCustomHide] = useState<CustomHideInput>({ itemClass: "Rings", rarity: "Normal", areaLevelMin: 65, itemLevelMax: 80, qualityMax: 0, identified: "any" });
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const rules = activeSection.rules.filter((rule) => `${getRuleTitle(rule)} ${getRuleDescription(rule)} ${rule.title} ${rule.tierTag ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const showCustomHideForm = activeSection.id.includes("hide") || activeSection.id === "hiding" || activeSection.id === "leveling-useful-magic-and-normal-items";
  useEffect(() => () => {
    Object.values(customSoundUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [customSoundUrls]);

  const handleCustomSoundFile = (ruleId: string, file: File, volume: number) => {
    setCustomSoundUrls((current) => {
      if (current[ruleId]) URL.revokeObjectURL(current[ruleId]);
      return { ...current, [ruleId]: URL.createObjectURL(file) };
    });
    updateRuleCustomSound(ruleId, file.name, volume);
  };

  const playCustomSound = (ruleId: string, volume: number) => {
    const src = customSoundUrls[ruleId];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume / 300));
    void audio.play();
  };

  return (
    <section className="view split-view">
      <aside className="section-list">
        <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋規則" /></label>
        {sections.map((section) => (
          <button key={section.id} className={section.id === activeSectionId ? "selected" : ""} onClick={() => setActiveSection(section.id)}>
            {sectionTitleTw[section.id] ?? section.titleTw}
          </button>
        ))}
      </aside>
      <div className="rule-panel">
        <div className="panel-title">
          <h1>{sectionTitleTw[activeSection.id] ?? activeSection.titleTw}</h1>
          <p>{sectionVisuals[activeSection.id]?.note ?? "調整這個分類的顯示、顏色與音效。"}</p>
        </div>
        {showCustomHideForm ? (
          <article className="rule-card custom-hide-card">
            <div className="rule-top">
              <div>
                <h2>新增隱藏規則</h2>
                <p>用簡單條件新增安全 Hide，不需要自己寫語法；匯出時會放在未知物品安全高亮前。</p>
              </div>
            </div>
            <div className="control-grid">
              <label>分類<select value={customHide.itemClass ?? ""} onChange={(event) => setCustomHide({ ...customHide, itemClass: event.target.value || undefined })}>
                <option value="">不限分類</option>
                {itemClassOptions.map((value) => <option key={value} value={value}>{translateItemName(value)}</option>)}
              </select></label>
              <label>稀有度<select value={customHide.rarity ?? ""} onChange={(event) => setCustomHide({ ...customHide, rarity: event.target.value || undefined })}>
                <option value="">不限稀有度</option>
                {["Normal", "Magic", "Rare", "Unique"].map((value) => <option key={value} value={value}>{rarityLabels[value]}</option>)}
              </select></label>
              <label>區域等級至少<input type="number" value={customHide.areaLevelMin ?? ""} onChange={(event) => setCustomHide({ ...customHide, areaLevelMin: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>物品等級最高<input type="number" value={customHide.itemLevelMax ?? ""} onChange={(event) => setCustomHide({ ...customHide, itemLevelMax: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>品質最高<input type="number" value={customHide.qualityMax ?? ""} onChange={(event) => setCustomHide({ ...customHide, qualityMax: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>鑑定狀態<select value={customHide.identified ?? "any"} onChange={(event) => setCustomHide({ ...customHide, identified: event.target.value as CustomHideInput["identified"] })}>
                <option value="any">不限</option>
                <option value="identified">已鑑定</option>
                <option value="unidentified">未鑑定</option>
              </select></label>
              <button className="inline-tool" type="button" onClick={() => addCustomHideRule(customHide)}>新增隱藏規則</button>
            </div>
          </article>
        ) : null}
        {rules.map((rule) => {
          const sizeAction = findAction(rule, "SetFontSize") as SizeAction | undefined;
          const size = sizeAction?.value ?? 36;
          const sound = findAction(rule, "PlayAlertSound") as SoundAction | undefined;
          const customSound = findAction(rule, "CustomAlertSound") as CustomSoundAction | undefined;
          return (
            <article className="rule-card" key={rule.id}>
              <div className="rule-top">
                <div>
                  <h2>{getRuleTitle(rule)}</h2>
                  <p>{getRuleDescription(rule)}</p>
                </div>
                <label className={`visibility-switch ${rule.enabled ? "is-shown" : "is-hidden"}`}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  <span className="switch-track"><span className="switch-thumb" /></span>
                  <strong>{rule.enabled ? <><Eye size={15} />顯示</> : <><EyeOff size={15} />隱藏</>}</strong>
                </label>
              </div>
              <RulePreview rule={rule} />
              <div className="control-grid">
                <label>字體大小<input type="range" min="18" max="45" value={size} onChange={(event) => updateRuleFontSize(rule.id, Number(event.target.value))} /></label>
                <ColorControl label="文字" rule={rule} keyword="SetTextColor" onChange={updateRuleColor} />
                <ColorControl label="邊框" rule={rule} keyword="SetBorderColor" onChange={updateRuleColor} />
                <ColorControl label="背景" rule={rule} keyword="SetBackgroundColor" onChange={updateRuleColor} />
                <label>音效<select value={String(sound?.id ?? 2)} onChange={(event) => updateRuleSound(rule.id, event.target.value, sound?.volume ?? 300)}>
                  {soundOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>音量<input type="range" min="0" max="300" value={sound?.volume ?? 300} onChange={(event) => updateRuleSound(rule.id, sound?.id ?? 2, Number(event.target.value))} /></label>
                <button className="inline-tool" type="button" onClick={() => playAlertSound(sound?.id ?? 2, sound?.volume ?? 300)}><Volume2 size={16} />試聽音效</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CustomizeV2() {
  const sections = useFilterStore((state) => state.sections);
  const activeSectionId = useFilterStore((state) => state.activeSectionId);
  const setActiveSection = useFilterStore((state) => state.setActiveSection);
  const toggleRule = useFilterStore((state) => state.toggleRule);
  const updateRuleFontSize = useFilterStore((state) => state.updateRuleFontSize);
  const updateRuleColor = useFilterStore((state) => state.updateRuleColor);
  const updateRuleSound = useFilterStore((state) => state.updateRuleSound);
  const updateRuleCustomSound = useFilterStore((state) => state.updateRuleCustomSound);
  const addCustomHideRule = useFilterStore((state) => state.addCustomHideRule);
  const [query, setQuery] = useState("");
  const [customSoundUrls, setCustomSoundUrls] = useState<Record<string, string>>({});
  const [customHide, setCustomHide] = useState<CustomHideInput>({ itemClass: "Rings", rarity: "Normal", areaLevelMin: 65, itemLevelMax: 80, qualityMax: 0, identified: "any" });
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const rules = activeSection.rules.filter((rule) => `${getRuleTitle(rule)} ${getRuleDescription(rule)} ${rule.title} ${rule.tierTag ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const showCustomHideForm = activeSection.id.includes("hide") || activeSection.id === "hiding" || activeSection.id === "leveling-useful-magic-and-normal-items";

  useEffect(() => () => {
    Object.values(customSoundUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [customSoundUrls]);

  const handleCustomSoundFile = (ruleId: string, file: File, volume: number) => {
    setCustomSoundUrls((current) => {
      if (current[ruleId]) URL.revokeObjectURL(current[ruleId]);
      return { ...current, [ruleId]: URL.createObjectURL(file) };
    });
    updateRuleCustomSound(ruleId, file.name, volume);
  };

  const playCustomSound = (ruleId: string, volume: number) => {
    const src = customSoundUrls[ruleId];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume / 300));
    void audio.play();
  };

  return (
    <section className="view split-view">
      <aside className="section-list">
        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋規則" />
        </label>
        {sections.map((section) => (
          <button key={section.id} className={section.id === activeSectionId ? "selected" : ""} onClick={() => setActiveSection(section.id)}>
            {sectionTitleTw[section.id] ?? section.titleTw}
          </button>
        ))}
      </aside>
      <div className="rule-panel">
        <div className="panel-title">
          <h1>{sectionTitleTw[activeSection.id] ?? activeSection.titleTw}</h1>
          <p>{sectionVisuals[activeSection.id]?.note ?? "調整這類掉落的顯示、顏色與音效。"}</p>
        </div>

        {showCustomHideForm ? (
          <article className="rule-card custom-hide-card">
            <div className="rule-top">
              <div>
                <h2>新增隱藏規則</h2>
                <p>用簡單條件建立 Hide 規則，會放在最後安全顯示未知物品之前。</p>
              </div>
            </div>
            <div className="control-grid">
              <label>分類<select value={customHide.itemClass ?? ""} onChange={(event) => setCustomHide({ ...customHide, itemClass: event.target.value || undefined })}>
                <option value="">不限分類</option>
                {itemClassOptions.map((value) => <option key={value} value={value}>{translateItemName(value)}</option>)}
              </select></label>
              <label>稀有度<select value={customHide.rarity ?? ""} onChange={(event) => setCustomHide({ ...customHide, rarity: event.target.value || undefined })}>
                <option value="">不限稀有度</option>
                {["Normal", "Magic", "Rare", "Unique"].map((value) => <option key={value} value={value}>{rarityLabels[value]}</option>)}
              </select></label>
              <label>最低區域等級<input type="number" value={customHide.areaLevelMin ?? ""} onChange={(event) => setCustomHide({ ...customHide, areaLevelMin: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>最高物品等級<input type="number" value={customHide.itemLevelMax ?? ""} onChange={(event) => setCustomHide({ ...customHide, itemLevelMax: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>最高品質<input type="number" value={customHide.qualityMax ?? ""} onChange={(event) => setCustomHide({ ...customHide, qualityMax: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>鑑定狀態<select value={customHide.identified ?? "any"} onChange={(event) => setCustomHide({ ...customHide, identified: event.target.value as CustomHideInput["identified"] })}>
                <option value="any">不限</option>
                <option value="identified">已鑑定</option>
                <option value="unidentified">未鑑定</option>
              </select></label>
              <button className="inline-tool" type="button" onClick={() => addCustomHideRule(customHide)}>新增隱藏規則</button>
            </div>
          </article>
        ) : null}

        {rules.map((rule) => {
          const sizeAction = findAction(rule, "SetFontSize") as SizeAction | undefined;
          const size = sizeAction?.value ?? 36;
          const sound = findAction(rule, "PlayAlertSound") as SoundAction | undefined;
          const customSound = findAction(rule, "CustomAlertSound") as CustomSoundAction | undefined;
          const soundVolume = customSound?.volume ?? sound?.volume ?? 300;
          return (
            <article className="rule-card" key={rule.id}>
              <div className="rule-top">
                <div>
                  <h2>{getRuleTitle(rule)}</h2>
                  <p>{getRuleDescription(rule)}</p>
                </div>
                <label className={`visibility-switch ${rule.enabled ? "is-shown" : "is-hidden"}`}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  <span className="switch-track"><span className="switch-thumb" /></span>
                  <strong>{rule.enabled ? <><Eye size={15} />顯示</> : <><EyeOff size={15} />隱藏</>}</strong>
                </label>
              </div>

              <RulePreview rule={rule} />

              <div className="control-grid">
                <label>字體大小<input type="range" min="18" max="45" value={size} onChange={(event) => updateRuleFontSize(rule.id, Number(event.target.value))} /></label>
                <ColorControl label="文字" rule={rule} keyword="SetTextColor" onChange={updateRuleColor} />
                <ColorControl label="邊框" rule={rule} keyword="SetBorderColor" onChange={updateRuleColor} />
                <ColorControl label="背景" rule={rule} keyword="SetBackgroundColor" onChange={updateRuleColor} />
                <label>音效<select value={customSound ? "custom" : String(sound?.id ?? 2)} onChange={(event) => {
                  if (event.target.value === "custom") {
                    updateRuleCustomSound(rule.id, customSound?.fileName ?? "custom-alert.mp3", soundVolume);
                    return;
                  }
                  updateRuleSound(rule.id, event.target.value, soundVolume);
                }}>
                  {soundOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  <option value="custom">自訂音效</option>
                </select></label>
                <label>音量<input type="range" min="0" max="300" value={soundVolume} onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  if (customSound) updateRuleCustomSound(rule.id, customSound.fileName, nextVolume);
                  else updateRuleSound(rule.id, sound?.id ?? 2, nextVolume);
                }} /></label>
                <button className="inline-tool" type="button" onClick={() => customSound ? playCustomSound(rule.id, customSound.volume) : playAlertSound(sound?.id ?? 2, sound?.volume ?? 300)} disabled={Boolean(customSound && !customSoundUrls[rule.id])}>
                  <Volume2 size={16} />試聽音效
                </button>
              </div>

              {customSound ? (
                <div className="custom-sound-panel">
                  <p>匯出後請把音效檔放在 `.filter` 同一個資料夾，檔名需保持一致：{customSound.fileName}</p>
                  <label className="image-input">
                    <ImageUp size={16} />
                    選擇音效檔
                    <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg" onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) handleCustomSoundFile(rule.id, file, customSound.volume);
                    }} />
                  </label>
                  <button className="inline-tool" type="button" onClick={() => playCustomSound(rule.id, customSound.volume)} disabled={!customSoundUrls[rule.id]}>
                    <Volume2 size={16} />試聽自訂音效
                  </button>
                  <button className="inline-tool" type="button" onClick={() => updateRuleSound(rule.id, 2, customSound.volume)}>改回預設音效</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ColorControl({ label, rule, keyword, onChange }: { label: string; rule: FilterRule; keyword: "SetTextColor" | "SetBorderColor" | "SetBackgroundColor"; onChange: (ruleId: string, keyword: "SetTextColor" | "SetBorderColor" | "SetBackgroundColor", value: Rgba) => void }) {
  const action = findAction(rule, keyword) as ColorAction | undefined;
  const value = action?.value ?? { r: 255, g: 255, b: 255, a: 255 };
  const hex = `#${[value.r, value.g, value.b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  return (
    <label>{label}<input type="color" value={hex} onChange={(event) => {
      const raw = event.target.value.replace("#", "");
      onChange(rule.id, keyword, { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16), a: value.a });
    }} /></label>
  );
}

function matchItemRecord(rawText: string) {
  const normalized = rawText.toLowerCase().replace(/[_-]+/g, " ");
  return itemRecords.find((record) => {
    const english = record.english.toLowerCase();
    const tw = record.tw.toLowerCase();
    return normalized.includes(english) || normalized.includes(tw);
  });
}

function getSimulationRuleTitle(rule: FilterRule, item: SimulationItem) {
  if (rule.id === "final-show-unknown") return "未知物品安全高亮";
  const itemName = translateItemName(item.baseType);
  if (rule.sectionId === "currency" || rule.sectionId === "special-currency" || rule.sectionId === "currency-exceptions-leveling-currencies") return `通貨分級：${itemName}`;
  if (rule.sectionId === "normal-waystone-progression") return `換界石：${item.waystoneTier ? `T${item.waystoneTier}` : itemName}`;
  if (rule.sectionId === "gems") return `寶石分級：${itemName}`;
  if (rule.sectionId === "uniques") return `傳奇物品：${itemName}`;
  if (rule.sectionId.includes("hide") || rule.directive === "Hide") return sectionTitleTw[rule.sectionId] ?? "隱藏規則";
  return sectionTitleTw[rule.sectionId] ?? getRuleTitle(rule, true);
}

function Simulate() {
  const sections = useFilterStore((state) => state.sections);
  const quickItems = [
    { label: "高價通貨", description: "神聖石、魔鏡這類掉落應該非常醒目", baseType: "Divine Orb", itemClass: "Stackable Currency", rarity: "Normal", icon: sectionVisuals.currency.icon },
    { label: "換界石", description: "檢查高階換界石是否被保留", baseType: "Waystone", itemClass: "Waystones", rarity: "Normal", waystoneTier: 15, icon: sectionVisuals["normal-waystone-progression"].icon },
    { label: "未切割寶石", description: "測試高等級未切割技能寶石", baseType: "Uncut Skill Gem", itemClass: "Skill Gems", rarity: "Normal", gemLevel: 19, icon: sectionVisuals.gems.icon },
    { label: "傳奇戒指", description: "確認傳奇裝備是否醒目顯示", baseType: "Gold Ring", itemClass: "Rings", rarity: "Unique", icon: sectionVisuals.uniques.icon },
    { label: "低價魔法裝", description: "嚴格度越高越可能被隱藏", baseType: "Gemini Bow", itemClass: "Bows", rarity: "Magic", icon: sectionVisuals.hiding.icon },
    { label: "未知新物品", description: "確認未知掉落會被安全高亮", baseType: "Future League Item", itemClass: "Unknown", rarity: "Normal", icon: sectionVisuals["new-league-unknown-items"].icon }
  ];
  const [item, setItem] = useState<SimulationItem>({
    baseType: "Divine Orb",
    itemClass: "Stackable Currency",
    rarity: "Normal",
    areaLevel: 80,
    itemLevel: 80,
    stackSize: 1,
    waystoneTier: 15,
    gemLevel: 19,
    unidentifiedItemTier: 4,
    width: 2,
    height: 3
  });
  const [imagePreview, setImagePreview] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [recognitionText, setRecognitionText] = useState("");
  const result = useMemo(() => simulateItem(sections, item), [sections, item]);
  const selectedItem = itemRecords.find((record) => record.english === item.baseType);
  const finalTitle = result.finalRule ? getSimulationRuleTitle(result.finalRule, item) : "沒有命中規則";
  const outcome = result.hidden ? "會隱藏" : result.finalRule?.id === "final-show-unknown" ? "會被高亮" : "會顯示";
  const outcomeTone = result.hidden ? "danger" : result.finalRule?.id === "final-show-unknown" ? "highlight" : "ok";
  const applyRecord = (record: ItemRecord) => {
    setItem((current) => ({
      ...current,
      baseType: record.english,
      itemClass: record.itemClass,
      rarity: current.rarity ?? "Normal"
    }));
  };
  const applyRecognitionText = (text: string) => {
    setRecognitionText(text);
    const record = matchItemRecord(text);
    if (record) {
      applyRecord(record);
      setImageNote(`已比對到：${record.tw}`);
    }
  };
  const handleImageFile = (file: File) => {
    setImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    const record = matchItemRecord(file.name);
    if (record) {
      applyRecord(record);
      setImageNote(`已從檔名比對到：${record.tw}`);
    } else {
      setImageNote("已匯入圖片。之後可用遊戲截圖輔助辨識；目前請搭配下方文字欄位。");
    }
  };
  const applyQuickItem = (quick: (typeof quickItems)[number]) => {
    setItem((current) => ({
      ...current,
      baseType: quick.baseType,
      itemClass: quick.itemClass,
      rarity: quick.rarity,
      areaLevel: 80,
      itemLevel: 80,
      stackSize: 1,
      waystoneTier: quick.waystoneTier ?? current.waystoneTier,
      gemLevel: quick.gemLevel ?? current.gemLevel,
      unidentifiedItemTier: 4
    }));
  };
  const readClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await clipboardItem.getType(imageType);
          handleImageFile(new File([blob], "clipboard-image.png", { type: imageType }));
          return;
        }
      }
    } catch {
      // Clipboard image access is browser-permission dependent; text fallback below still helps.
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        applyRecognitionText(text);
        if (!matchItemRecord(text)) setImageNote("已讀取剪貼簿文字，但沒有比對到目前資料表中的物品。");
        return;
      }
    } catch {
      setImageNote("瀏覽器沒有允許讀取剪貼簿，請改用匯入圖片或手動貼上文字。");
      return;
    }

    setImageNote("剪貼簿沒有可用的圖片或文字。");
  };

  return (
    <section className="view simulate-view">
      <div className="form-panel">
        <h1>掉落模擬</h1>
        <p>選物品、看結果，再確認它為什麼會被顯示或隱藏。</p>
        <h2>選物品</h2>
        <div className="scenario-grid">
          {quickItems.map((quick) => (
            <button key={quick.label} type="button" className={item.baseType === quick.baseType ? "scenario-card selected" : "scenario-card"} onClick={() => applyQuickItem(quick)}>
              <img src={quick.icon} alt="" />
              <strong>{quick.label}</strong>
              <span>{quick.description}</span>
            </button>
          ))}
        </div>
        <label>物品<select value={item.baseType} onChange={(event) => {
          const record = itemRecords.find((candidate) => candidate.english === event.target.value);
          setItem({ ...item, baseType: event.target.value, itemClass: record?.itemClass ?? item.itemClass });
        }}>{itemRecords.map((record) => <option key={record.id} value={record.english}>{record.tw}</option>)}</select></label>
        <label>稀有度<select value={item.rarity} onChange={(event) => setItem({ ...item, rarity: event.target.value })}>{["Normal", "Magic", "Rare", "Unique"].map((value) => <option key={value} value={value}>{rarityLabels[value]}</option>)}</select></label>
        <div
          className="image-assist"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file?.type.startsWith("image/")) handleImageFile(file);
          }}
        >
          <div className="image-actions">
            <label className="image-input"><ImageUp size={18} /> 匯入遊戲截圖<input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImageFile(file);
            }} /></label>
            <button type="button" className="image-input" onClick={readClipboard}><ClipboardPaste size={18} /> 貼上剪貼簿</button>
          </div>
          {imagePreview ? <img src={imagePreview} alt="匯入的掉落截圖預覽" /> : <p>之後可用遊戲截圖輔助辨識；目前先用截圖檔名或下方文字欄位比對。</p>}
          <label><ClipboardPaste size={16} /> 截圖文字 / 物品名稱<input value={recognitionText} onChange={(event) => applyRecognitionText(event.target.value)} placeholder="例如：神聖石、Divine Orb、換界石" /></label>
          {imageNote ? <span>{imageNote}</span> : null}
        </div>
        <details className="advanced-sim">
          <summary>進階模擬條件</summary>
          <div className="mini-grid">
            <label>區域等級<input type="number" value={item.areaLevel ?? 0} onChange={(event) => setItem({ ...item, areaLevel: Number(event.target.value) })} /></label>
            <label>物品等級<input type="number" value={item.itemLevel ?? 0} onChange={(event) => setItem({ ...item, itemLevel: Number(event.target.value) })} /></label>
            <label>堆疊數量<input type="number" value={item.stackSize ?? 1} onChange={(event) => setItem({ ...item, stackSize: Number(event.target.value) })} /></label>
            <label>寶石等級<input type="number" value={item.gemLevel ?? 0} onChange={(event) => setItem({ ...item, gemLevel: Number(event.target.value) })} /></label>
            <label>換界石階級<input type="number" value={item.waystoneTier ?? 0} onChange={(event) => setItem({ ...item, waystoneTier: Number(event.target.value) })} /></label>
            <label>未鑑定階級<input type="number" value={item.unidentifiedItemTier ?? 0} onChange={(event) => setItem({ ...item, unidentifiedItemTier: Number(event.target.value) })} /></label>
          </div>
        </details>
      </div>
      <div className="result-panel">
        <h2>看結果</h2>
        <div className="item-title">
          <Gem />
          <div>
            <h1>{selectedItem?.tw ?? item.baseType}</h1>
            <p>{classTranslations[item.itemClass] ?? "特殊掉落物"}</p>
          </div>
        </div>
        {result.finalRule ? <RulePreview rule={result.finalRule} label={selectedItem?.tw ?? translateItemName(item.baseType)} /> : null}
        <div className={`result-hero ${outcomeTone}`}>
          <strong>{outcome}</strong>
          <span>{result.hidden ? "目前嚴格度會把它收起來。" : result.finalRule?.id === "final-show-unknown" ? "這類物品不在已知清單內，所以用安全高亮提醒。" : "目前嚴格度會讓它出現在地上。"}</span>
        </div>
        <p className="plain-result">
          命中分類：{finalTitle}。
        </p>
        <h2>為什麼</h2>
        <ol className="match-list">{result.matchedRules.map((rule) => <li key={rule.id}>{getSimulationRuleTitle(rule, item)}{rule.continue ? "，再往下確認更精準的分類" : ""}</li>)}</ol>
      </div>
    </section>
  );
}

function Themes() {
  const applyTheme = useFilterStore((state) => state.applyTheme);
  const settings = useFilterStore((state) => state.settings);
  return (
    <section className="view">
      <div className="view-header"><h1>外觀主題</h1><p>同一套顯示與隱藏規則，可以套用不同的色彩、音效、光柱與地圖圖示風格。</p></div>
      <div className="theme-grid">
        {themePresets.map((theme) => (
          <button className={`theme-card ${styleLabels[settings.style] === themeNameTw[theme.id] || settings.style.toLowerCase().includes(theme.id) ? "selected" : ""}`} key={theme.id} onClick={() => applyTheme(theme.id)} style={{ borderColor: theme.accent }}>
            <span style={{ background: theme.accent }} />
            <h2>{themeNameTw[theme.id] ?? theme.name}</h2>
            <p>{theme.description}</p>
            <strong>{settings.style.toLowerCase().includes(theme.id) || (theme.id === "default" && settings.style === "Default") ? "目前使用" : "套用主題"}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function Advanced() {
  const generatedFilter = useFilterStore((state) => state.generatedFilter);
  const sections = useFilterStore((state) => state.sections);
  const settings = useFilterStore((state) => state.settings);
  const manualEnabledRuleIds = useFilterStore((state) => state.manualEnabledRuleIds);
  const strictnessProfileData = useFilterStore((state) => state.strictnessProfileData);
  const applyStrictnessProfileData = useFilterStore((state) => state.applyStrictnessProfileData);
  const importState = useFilterStore((state) => state.importState);
  const validation = validateFilterSyntax(generatedFilter);
  const [editorText, setEditorText] = useState(generatedFilter);
  const [message, setMessage] = useState("");
  return (
    <section className="view">
      <div className="view-header"><h1>進階工具</h1><p>備份設定、檢查輸出，或匯入 FilterBlade 實測嚴格度檔案。</p></div>
      <div className="advanced-grid">
        <div className="advanced-card">
          <h2>語法指令檢查</h2>
          <div className="token-grid">{validation.map((item) => <span className={item.present ? "token-ok" : "token-missing"} key={item.token}>{item.present ? <Check size={14} /> : null}{item.token}</span>)}</div>
          <button onClick={() => downloadTextFile("poe2-tw-filter-settings.json", JSON.stringify({ sections, settings, manualEnabledRuleIds, strictnessProfileData }, null, 2))}>下載設定檔</button>
          <label className="file-input">匯入設定檔<input type="file" accept="application/json" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const ok = importState(JSON.parse(await file.text()));
            setMessage(ok ? "設定匯入成功" : "設定格式不正確");
          }} /></label>
          <label className="file-input">匯入七份嚴格度檔<input type="file" accept=".filter" multiple onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;
            try {
              const profile = await buildProfileFromFilterFiles(files, sections);
              applyStrictnessProfileData(profile);
              setMessage("嚴格度實測檔已套用");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "嚴格度檔案解析失敗");
            }
          }} /></label>
          <div className="profile-source">
            <strong>{strictnessProfileData.source}</strong>
            <span>日期：{new Date(strictnessProfileData.generatedAt).toLocaleDateString()}</span>
            <span>目前：{strictnessLabels[settings.strictness]} / {strictnessProfileData.strictnesses[settings.strictness]?.sourceFile}</span>
          </div>
          {message ? <p>{message}</p> : null}
        </div>
        <div className="editor-card">
          <Editor height="520px" language="plaintext" theme="vs-dark" value={editorText} onChange={(value) => setEditorText(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on" }} />
        </div>
      </div>
    </section>
  );
}

function ExportView() {
  const generatedFilter = useFilterStore((state) => state.generatedFilter);
  const save = useFilterStore((state) => state.save);
  const load = useFilterStore((state) => state.load);
  const reset = useFilterStore((state) => state.reset);
  const saveStatus = useFilterStore((state) => state.saveStatus);
  const settings = useFilterStore((state) => state.settings);
  const strictnessProfileData = useFilterStore((state) => state.strictnessProfileData);
  const currentProfile = strictnessProfileData.strictnesses[settings.strictness];
  const exportName = `Taiwan_PoE2_${settings.strictness.replace(/[^A-Za-z0-9]+/g, "_")}.filter`;
  return (
    <section className="view export-view">
      <div className="view-header">
        <div><h1>匯出到 PoE2</h1><p>下載後放入 `%userprofile%/Documents/My Games/Path of Exile 2/`，再到遊戲 UI 選取 filter。</p></div>
        <button className="primary" onClick={() => downloadTextFile(exportName, generatedFilter)}><Download size={18} />下載過濾器</button>
      </div>
      <div className="export-grid">
        <article>
          <h2>目前設定</h2>
          <p>嚴格度：{strictnessLabels[settings.strictness] ?? settings.strictness}</p>
          <p>嚴格度來源：{strictnessProfileData.source}</p>
          <p>實測檔案：{currentProfile?.sourceFile ?? "內建資料"} / {new Date(strictnessProfileData.generatedAt).toLocaleDateString()}</p>
          <p>外觀：{styleLabels[settings.style] ?? settings.style}</p>
          <p>作者：{settings.author}</p>
          <p>{saveStatus}</p>
          <div className="button-row">
            <button onClick={save}><Save size={16} />保存</button>
            <button onClick={load}><RefreshCcw size={16} />載入</button>
            <button onClick={reset}>重設</button>
          </div>
        </article>
        <article>
          <h2>相容性基準</h2>
          <p>輸出會保留遊戲需要的英文語法、物品分類與基底名稱，並保留未知物品安全高亮。</p>
          <pre className="install-path">%userprofile%/Documents/My Games/Path of Exile 2/</pre>
        </article>
      </div>
    </section>
  );
}

function PrivacyView() {
  return (
    <section className="view legal-view">
      <h1>隱私權政策</h1>
      <article>
        <h2>本機資料</h2>
        <p>本工具會把你的過濾器設定保存在瀏覽器的 IndexedDB。這些資料留在你的裝置上，不會上傳到本站伺服器。</p>
        <h2>下載與匯入</h2>
        <p>你匯入的設定檔、圖片或文字只用於目前瀏覽器中的比對與模擬。匯出的 `.filter` 由瀏覽器直接產生。</p>
        <h2>廣告與 Cookie</h2>
        <p>之後若啟用 Google AdSense，Google 可能會使用 Cookie 或類似技術投放與衡量廣告。你可以透過瀏覽器或 Google 廣告設定管理個人化廣告。</p>
      </article>
    </section>
  );
}

function GuideView() {
  return (
    <section className="view legal-view">
      <h1>使用說明</h1>
      <article>
        <h2>基本流程</h2>
        <p>先在總覽選擇嚴格度，再到自訂規則調整顯示、隱藏、顏色與音效。調整完成後，到匯出頁下載遊戲可讀取的 `.filter` 檔案。</p>
        <h2>匯出到遊戲</h2>
        <p>到匯出頁下載 `.filter`，放入 `%userprofile%/Documents/My Games/Path of Exile 2/`，再進入遊戲選取該過濾器。</p>
        <h2>繁中與英文語法</h2>
        <p>介面使用繁體中文協助台服玩家理解；匯出的 filter 仍保留遊戲可讀取的英文物品名稱與分類。</p>
      </article>
    </section>
  );
}

function DisclaimerView() {
  return (
    <section className="view legal-view">
      <h1>免責聲明</h1>
      <article>
        <p>本站是玩家自製工具，並非 Grinding Gear Games、FilterBlade、NeverSink 或 poe2db 官方服務。</p>
        <p>過濾器資料以實測與公開資料整理為基礎，但遊戲版本與物品資料可能更新。使用前建議先在遊戲內確認載入與顯示結果。</p>
        <p>Path of Exile 2 與相關素材權利歸其各自權利人所有。本站僅提供玩家便利工具與繁體中文輔助介面。</p>
      </article>
    </section>
  );
}

function ContactView() {
  return (
    <section className="view legal-view">
      <h1>聯絡方式</h1>
      <article>
        <p>若發現翻譯、物品圖示、篩選器輸出或廣告顯示有問題，請透過專案頁面或站長公開聯絡方式回報。</p>
        <p>Gmail：<a href="mailto:a0202001234@gmail.com">a0202001234@gmail.com</a></p>
        <p>Discord：black930</p>
        <p>也可以透過 <a href="https://github.com/An67dy04/poe2-tw-filter-maker/issues" target="_blank" rel="noreferrer">GitHub Issues</a> 回報問題。</p>
      </article>
    </section>
  );
}

function Footer({ onNavigate }: { onNavigate: (screen: ScreenId) => void }) {
  return (
    <footer className="site-footer">
      <div>
        <strong>台服 PoE2 過濾器製造機</strong>
        <span>玩家自製工具，設定保存在你的瀏覽器。</span>
      </div>
      <nav aria-label="網站資訊">
        {footerLinks.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onNavigate(id)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
    </footer>
  );
}

function App() {
  const [screen, setScreen] = useState<ScreenId>("overview");
  const settings = useFilterStore((state) => state.settings);
  const updateSettings = useFilterStore((state) => state.updateSettings);
  const setActiveSection = useFilterStore((state) => state.setActiveSection);
  const openSection = (sectionId: string) => {
    setActiveSection(sectionId);
    setScreen("customize");
  };

  return (
    <main className="app-shell" data-style={settings.style}>
      <AdsenseLoader />
      <AdSlot placement="left" label="左側廣告" />
      <div className="app-main">
        <aside className="sidebar">
          <div className="brand"><FlaskConical /><div><strong>流亡黯道 2</strong><span>台服過濾器製造機</span></div></div>
          <nav>{screens.map(({ id, label, icon: Icon }) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}><Icon size={18} />{label}</button>)}</nav>
          <div className="settings-box">
            <label>作者<input value={settings.author} onChange={(event) => updateSettings({ author: event.target.value })} /></label>
          </div>
        </aside>
        <div className="content">
          {screen === "overview" && <Overview onOpenSection={openSection} />}
          {screen === "customize" && <CustomizeV2 />}
          {screen === "simulate" && <Simulate />}
          {screen === "themes" && <Themes />}
          {screen === "advanced" && <Advanced />}
          {screen === "export" && <ExportView />}
          {screen === "privacy" && <PrivacyView />}
          {screen === "guide" && <GuideView />}
          {screen === "disclaimer" && <DisclaimerView />}
          {screen === "contact" && <ContactView />}
          <AdSlot placement="mobile" label="內容廣告" />
          <Footer onNavigate={setScreen} />
        </div>
      </div>
      <AdSlot placement="right" label="右側廣告" />
    </main>
  );
}

export default App;
