export type ScreenId = "overview" | "customize" | "simulate" | "themes" | "advanced" | "export" | "privacy" | "guide" | "disclaimer" | "contact";

export type FilterDirective = "Show" | "Hide";

export type RuleCondition =
  | { keyword: "Class" | "BaseType" | "Rarity"; operator?: "==" | "!="; values: string[] }
  | { keyword: "AreaLevel" | "ItemLevel" | "DropLevel" | "StackSize" | "Quality" | "Sockets" | "GemLevel" | "WaystoneTier" | "UnidentifiedItemTier" | "Width" | "Height" | "BaseArmour" | "BaseEvasion" | "BaseEnergyShield"; operator: ">=" | "<=" | ">" | "<" | "="; value: number }
  | { keyword: "Corrupted" | "Mirrored" | "Identified" | "TwiceCorrupted" | "AnyEnchantment" | "AlwaysShow" | "IsVaalUnique" | "HasVaalUniqueMod"; value: boolean }
  | { keyword: "HasExplicitMod"; values: string[] };

export type FilterAction =
  | { keyword: "SetFontSize"; value: number }
  | { keyword: "SetTextColor" | "SetBorderColor" | "SetBackgroundColor"; value: Rgba }
  | { keyword: "PlayAlertSound"; id: number | string; volume: number }
  | { keyword: "CustomAlertSound"; fileName: string; volume: number }
  | { keyword: "PlayEffect"; color: BeamColor; temp?: boolean }
  | { keyword: "MinimapIcon"; size: 0 | 1 | 2; color: IconColor; shape: IconShape }
  | { keyword: "DisableDropSound"; value: boolean };

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type BeamColor = "Red" | "Green" | "Blue" | "Brown" | "White" | "Yellow" | "Cyan" | "Grey" | "Orange" | "Pink" | "Purple";
export type IconColor = BeamColor;
export type IconShape = "Circle" | "Diamond" | "Hexagon" | "Square" | "Star" | "Triangle" | "Cross" | "Moon" | "Raindrop" | "Kite" | "Pentagon" | "UpsideDownHouse";

export interface FilterRule {
  id: string;
  sectionId: string;
  title: string;
  directive: FilterDirective;
  enabled: boolean;
  tierTag?: string;
  descriptionTw: string;
  conditions: RuleCondition[];
  actions: FilterAction[];
  continue?: boolean;
  priority: number;
  sourceLine?: number;
}

export interface FilterSection {
  id: string;
  code: string;
  title: string;
  titleTw: string;
  waypoint?: string;
  rules: FilterRule[];
}

export interface ItemRecord {
  id: string;
  english: string;
  tw: string;
  itemClass: string;
  category: string;
  sourceUrl: string;
}

export interface SimulationItem {
  baseType: string;
  itemClass: string;
  rarity?: string;
  areaLevel?: number;
  itemLevel?: number;
  dropLevel?: number;
  stackSize?: number;
  quality?: number;
  sockets?: number;
  gemLevel?: number;
  waystoneTier?: number;
  unidentifiedItemTier?: number;
  corrupted?: boolean;
  mirrored?: boolean;
  identified?: boolean;
  width?: number;
  height?: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  description: string;
}

export interface FilterSettings {
  strictness: "Soft" | "Regular" | "Semi-Strict" | "Strict" | "Very Strict" | "Uber Strict" | "Uber+1 Strict";
  style: "Default" | "High Contrast" | "Taiwan Trade" | "Streamer";
  author: string;
  version: string;
}

export interface CustomHideInput {
  itemClass?: string;
  rarity?: string;
  areaLevelMin?: number;
  itemLevelMax?: number;
  qualityMax?: number;
  identified?: "any" | "identified" | "unidentified";
}

export interface StrictnessProfileEntry {
  name: FilterSettings["strictness"];
  sourceFile: string;
  ruleCount: number;
  matchedRuleCount: number;
  disabledRuleIds: string[];
}

export interface StrictnessProfileData {
  generatedAt: string;
  source: string;
  sourceUrl?: string;
  sourceZip?: string;
  baseline: string;
  strictnesses: Record<FilterSettings["strictness"], StrictnessProfileEntry>;
}
