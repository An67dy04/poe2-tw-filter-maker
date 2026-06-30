import { describe, expect, it } from "vitest";
import poe2dbTranslations from "../data/poe2dbTranslations.generated.json";
import strictnessProfiles from "../data/strictnessProfiles.json";
import { defaultSections } from "./defaultRules";
import { generateFilter, simulateItem, validateFilterSyntax } from "./filterDsl";

const filterText = generateFilter(defaultSections, {
  author: "Test",
  strictness: "Semi-Strict",
  style: "Default",
  version: "test"
});

describe("filter DSL", () => {
  it("renders required FilterBlade-compatible directives", () => {
    const validation = validateFilterSyntax(filterText);
    expect(validation.every((item) => item.present)).toBe(true);
    expect(filterText).toContain("[[0100]] Gold");
    expect(filterText).toContain("[[2600]] Currency - Regular Currency Tiering");
    expect(filterText).toContain("Hide # $type->hidelayer $tier->final");
    expect(filterText).toContain("Show # $type->anyremaining $tier->restex !utility_unknownitem");
  });

  it("keeps game-facing item names in English", () => {
    expect(filterText).toContain('"Divine Orb"');
    expect(filterText).not.toContain("神聖石");
  });

  it("continues after decorator rules", () => {
    const result = simulateItem(defaultSections, {
      baseType: "Waystone",
      itemClass: "Waystones",
      rarity: "Normal",
      waystoneTier: 15,
      areaLevel: 80
    });
    expect(result.matchedRules.map((rule) => rule.id)).toContain("normal-waystone-progression-1");
    expect(result.finalRule?.id).toBe("normal-waystone-progression-28");
    expect(result.hidden).toBe(false);
  });

  it("falls back to unknown safety highlight", () => {
    const result = simulateItem(defaultSections, {
      baseType: "Future League Item",
      itemClass: "Unknown",
      rarity: "Normal",
      areaLevel: 90
    });
    expect(result.finalRule?.id).toBe("final-show-unknown");
    expect(result.hidden).toBe(false);
  });

  it("contains PoE2DB Traditional Chinese names for UI lookup", () => {
    const translations = (poe2dbTranslations as { translations: Record<string, string> }).translations;
    expect(translations.Ring).toBe("戒指");
    expect(translations["Gold Ring"]).toBe("金光戒指");
    expect(translations["Ancestral Tiara"]).toBe("先祖頭冠");
  });

  it("has strictness profiles that change exported rule counts", () => {
    const data = strictnessProfiles as { source: string; strictnesses: Record<string, { ruleCount: number; disabledRuleIds: string[] }> };
    const profiles = data.strictnesses;
    expect(data.source).toContain("FilterBlade PoE2");
    expect(profiles.Soft.ruleCount).toBe(460);
    expect(profiles["Semi-Strict"].ruleCount).toBe(457);
    expect(profiles["Uber+1 Strict"].ruleCount).toBe(285);
    expect(profiles.Strict.disabledRuleIds.length).toBeGreaterThan(0);
    expect(profiles["Uber+1 Strict"].disabledRuleIds.length).toBeGreaterThan(profiles.Strict.disabledRuleIds.length);
    expect(profiles["Uber+1 Strict"].disabledRuleIds).not.toContain("final-show-unknown");
  });

  it("renders custom alert sounds with quoted file names", () => {
    const customFilter = generateFilter([
      {
        id: "custom-sound",
        code: "9999",
        title: "Custom Sound",
        titleTw: "自訂音效",
        rules: [
          {
            id: "custom-sound-rule",
            sectionId: "custom-sound",
            title: "Custom sound rule",
            directive: "Show",
            enabled: true,
            descriptionTw: "自訂音效測試",
            conditions: [{ keyword: "BaseType", values: ["Divine Orb"] }],
            actions: [{ keyword: "CustomAlertSound", fileName: "my alert.mp3", volume: 300 }],
            priority: 1
          }
        ]
      }
    ], {
      author: "Test",
      strictness: "Semi-Strict",
      style: "Default",
      version: "test"
    });
    expect(customFilter).toContain('CustomAlertSound "my alert.mp3" 300');
  });
});
