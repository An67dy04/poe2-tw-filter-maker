import filterbladeSections from "../data/filterbladeSections.json";
import type { FilterSection, ThemePreset } from "../types";

export const themePresets: ThemePreset[] = [
  { id: "default", name: "預設高亮", accent: "#f4b942", description: "接近 NeverSink 預設高亮，適合多數玩家。" },
  { id: "contrast", name: "高對比", accent: "#00d1ff", description: "提高邊框與背景對比，適合小螢幕或直播。" },
  { id: "trade", name: "台服交易", accent: "#ff5b7f", description: "強化高價通貨、交易品與換界石提示。" },
  { id: "streamer", name: "直播模式", accent: "#9dff6a", description: "更大的字體、更多光柱與地圖圖示。" }
];

export const defaultSections = filterbladeSections as FilterSection[];

export const legacyPrototypeSections: FilterSection[] = [
  {
    id: "gold",
    code: "0100",
    title: "Gold",
    titleTw: "金幣",
    waypoint: "c0.start",
    rules: [
      {
        id: "gold-stack-5000",
        sectionId: "gold",
        title: "Huge Gold Stack",
        directive: "Show",
        enabled: true,
        tierTag: "%D7 $type->gold $tier->stack3 !gold_pilehuge",
        descriptionTw: "5000 以上金幣堆，顯示白字黃底與橘色光柱。",
        priority: 100,
        conditions: [
          { keyword: "StackSize", operator: ">=", value: 5000 },
          { keyword: "BaseType", operator: "==", values: ["Gold"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 40 },
          { keyword: "SetTextColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 20, g: 20, b: 0, a: 255 } },
          { keyword: "PlayEffect", color: "Orange" },
          { keyword: "MinimapIcon", size: 1, color: "Yellow", shape: "Cross" }
        ]
      },
      {
        id: "gold-stack-650",
        sectionId: "gold",
        title: "Medium Gold Stack",
        directive: "Show",
        enabled: true,
        tierTag: "%D5 $type->gold $tier->stack1 !gold_pilemedium",
        descriptionTw: "650 以上金幣堆，中等高亮。",
        priority: 90,
        conditions: [
          { keyword: "StackSize", operator: ">=", value: 650 },
          { keyword: "BaseType", operator: "==", values: ["Gold"] }
        ],
        actions: [
          { keyword: "SetTextColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "PlayEffect", color: "Orange", temp: true }
        ]
      }
    ]
  },
  {
    id: "exotic",
    code: "0200",
    title: "Exotic Bases",
    titleTw: "特殊基底",
    waypoint: "c1.exoticbases",
    rules: [
      {
        id: "exotic-chancing",
        sectionId: "exotic",
        title: "Chancing Bases",
        directive: "Show",
        enabled: true,
        tierTag: "%D7 $type->chancing $tier->chancea !itemproperty_achancing",
        descriptionTw: "可用機會石賭高價傳奇的基底。",
        priority: 85,
        conditions: [
          { keyword: "Rarity", values: ["Normal", "Magic"] },
          { keyword: "BaseType", operator: "==", values: ["Gold Ring", "Silver Charm", "Sacrificial Regalia"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 0, g: 70, b: 255, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 0, g: 70, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Blue" },
          { keyword: "MinimapIcon", size: 1, color: "Blue", shape: "Diamond" }
        ]
      }
    ]
  },
  {
    id: "exceptional",
    code: "0300",
    title: "Exceptional Items",
    titleTw: "例外高價物品",
    waypoint: "c2.exceptional",
    rules: [
      {
        id: "exceptional-overquality",
        sectionId: "exceptional",
        title: "Overquality and Oversocket",
        directive: "Show",
        enabled: true,
        tierTag: "%D9 $type->exotic->exceptional $tier->overqual !exotics_artifacthigh",
        descriptionTw: "高品質、高洞數或特殊狀態物品，使用頂級高亮。",
        priority: 98,
        conditions: [
          { keyword: "Quality", operator: ">=", value: 20 },
          { keyword: "Rarity", values: ["Normal", "Magic", "Rare"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 45 },
          { keyword: "SetTextColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 6, volume: 300 },
          { keyword: "PlayEffect", color: "Red" },
          { keyword: "MinimapIcon", size: 0, color: "Red", shape: "Star" }
        ]
      }
    ]
  },
  {
    id: "hiding",
    code: "0600",
    title: "Normal, Magic, Rare Hiding Rules",
    titleTw: "普通、魔法、稀有隱藏規則",
    waypoint: "c3.gear.any.hiding",
    rules: [
      {
        id: "hide-normal-magic-endgame",
        sectionId: "hiding",
        title: "Hide low value normal and magic endgame gear",
        directive: "Hide",
        enabled: true,
        tierTag: "$type->hidelayer $tier->normalmagicendgame",
        descriptionTw: "終局區域隱藏大多數低價普通與魔法裝備。",
        priority: 20,
        conditions: [
          { keyword: "Rarity", values: ["Normal", "Magic"] },
          { keyword: "Class", operator: "==", values: ["Body Armours", "Boots", "Bows", "Crossbows", "Gloves", "Helmets", "One Hand Maces", "Quarterstaves", "Quivers", "Shields", "Spears", "Staves", "Two Hand Maces", "Wands"] },
          { keyword: "AreaLevel", operator: ">=", value: 65 }
        ],
        actions: [
          { keyword: "SetFontSize", value: 18 },
          { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 0 } },
          { keyword: "SetBackgroundColor", value: { r: 20, g: 20, b: 0, a: 0 } },
          { keyword: "DisableDropSound", value: true }
        ]
      }
    ]
  },
  {
    id: "high-mod-tier",
    code: "0800",
    title: "High Unidentified Mod Tier",
    titleTw: "高階未鑑定詞綴階級",
    waypoint: "c3.exotic.state.hightier",
    rules: [
      {
        id: "rare-unidentified-tier-4",
        sectionId: "high-mod-tier",
        title: "Tier 4+ unidentified rares",
        directive: "Show",
        enabled: true,
        tierTag: "%D7 $type->ut->rare $tier->gear4a !exotics_btier",
        descriptionTw: "未鑑定詞綴階級 4 以上的稀有裝備。",
        priority: 92,
        conditions: [
          { keyword: "UnidentifiedItemTier", operator: ">=", value: 4 },
          { keyword: "Rarity", values: ["Rare"] },
          { keyword: "BaseType", operator: "==", values: ["Gemini Bow", "Rattling Sceptre", "Omen Sceptre", "Warmonger Bow", "Wolfskin Mantle"] },
          { keyword: "AreaLevel", operator: ">=", value: 65 }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 0, g: 240, b: 190, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 0, g: 240, b: 190, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 0, g: 75, b: 30, a: 255 } },
          { keyword: "PlayAlertSound", id: 3, volume: 300 },
          { keyword: "PlayEffect", color: "Blue" },
          { keyword: "MinimapIcon", size: 0, color: "Blue", shape: "Diamond" }
        ]
      }
    ]
  },
  {
    id: "socketables",
    code: "1900",
    title: "Socketables - Runes and Soul Cores",
    titleTw: "符文與靈魂核心",
    waypoint: "c7.socketables",
    rules: [
      {
        id: "socketable-runes",
        sectionId: "socketables",
        title: "Socketable runes",
        directive: "Show",
        enabled: true,
        tierTag: "%D6 $type->socketables $tier->runes !currency_b",
        descriptionTw: "符文與可鑲嵌物。",
        priority: 88,
        conditions: [{ keyword: "BaseType", operator: "==", values: ["Conductive Runes", "Soul Core of Tacati", "Soul Core of Zalatl"] }],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 0, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 245, g: 105, b: 90, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Yellow" },
          { keyword: "MinimapIcon", size: 1, color: "Yellow", shape: "Circle" }
        ]
      }
    ]
  },
  {
    id: "jewels",
    code: "2000",
    title: "Jewels",
    titleTw: "珠寶",
    waypoint: "c7.jewels",
    rules: [
      {
        id: "time-lost-jewels",
        sectionId: "jewels",
        title: "Time-Lost Jewels",
        directive: "Show",
        enabled: true,
        tierTag: "$type->jewels $tier->timelost !exotics_btier",
        descriptionTw: "Time-Lost 珠寶，保留高亮與藍色光柱。",
        priority: 86,
        conditions: [
          { keyword: "Rarity", values: ["Normal", "Magic", "Rare"] },
          { keyword: "Class", operator: "==", values: ["Jewels"] },
          { keyword: "BaseType", operator: "==", values: ["Time-Lost Emerald", "Time-Lost Ruby", "Time-Lost Sapphire", "Emerald", "Ruby", "Sapphire"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 0, g: 70, b: 255, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 0, g: 70, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Blue" },
          { keyword: "MinimapIcon", size: 1, color: "Blue", shape: "Diamond" }
        ]
      }
    ]
  },
  {
    id: "relics",
    code: "2100",
    title: "Relics",
    titleTw: "聖物",
    waypoint: "c8.relics",
    rules: [
      {
        id: "relic-catcher",
        sectionId: "relics",
        title: "Relic catcher",
        directive: "Show",
        enabled: true,
        tierTag: "$type->relics $tier->all !typebased_quest",
        descriptionTw: "顯示聖物與試煉相關物品。",
        priority: 80,
        conditions: [{ keyword: "BaseType", operator: "==", values: ["Vase Relic", "Incense Relic", "Urn Relic"] }],
        actions: [
          { keyword: "SetFontSize", value: 40 },
          { keyword: "SetTextColor", value: { r: 74, g: 230, b: 58, a: 255 } },
          { keyword: "PlayAlertSound", id: 3, volume: 300 },
          { keyword: "PlayEffect", color: "Green" }
        ]
      }
    ]
  },
  {
    id: "gems",
    code: "2200",
    title: "Gems and Uncut Gems",
    titleTw: "寶石與未切割寶石",
    waypoint: "c8.gems.uncut",
    rules: [
      {
        id: "uncut-skill-gem-19",
        sectionId: "gems",
        title: "High level uncut skill gems",
        directive: "Show",
        enabled: true,
        tierTag: "$type->gems->uncut $tier->high !gems_high",
        descriptionTw: "高等級未切割技能寶石。",
        priority: 90,
        conditions: [
          { keyword: "GemLevel", operator: ">=", value: 19 },
          { keyword: "BaseType", values: ["Uncut Skill Gem", "Uncut Spirit Gem"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 20, g: 240, b: 240, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 20, g: 240, b: 240, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 20, g: 20, b: 0, a: 255 } },
          { keyword: "PlayAlertSound", id: 3, volume: 300 },
          { keyword: "PlayEffect", color: "Cyan" },
          { keyword: "MinimapIcon", size: 1, color: "Cyan", shape: "Star" }
        ]
      }
    ]
  },
  {
    id: "waystones",
    code: "2300",
    title: "Waystones",
    titleTw: "換界石",
    waypoint: "c9.waystones.all",
    rules: [
      {
        id: "waystone-decorator-15",
        sectionId: "waystones",
        title: "Tier 15+ waystone decorator",
        directive: "Show",
        enabled: true,
        tierTag: "$type->waystones $tier->decomap1 !maps_deco1",
        descriptionTw: "15 階以上換界石裝飾器，使用 Continue 疊加後續規則。",
        priority: 95,
        conditions: [
          { keyword: "WaystoneTier", operator: ">=", value: 15 },
          { keyword: "Class", operator: "==", values: ["Waystones"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 255 } }
        ],
        continue: true
      },
      {
        id: "waystone-tier-15",
        sectionId: "waystones",
        title: "Tier 15+ waystones",
        directive: "Show",
        enabled: true,
        tierTag: "$type->waystones $tier->t15 !maps_high",
        descriptionTw: "15 階以上換界石，白底黑字與高音效。",
        priority: 89,
        conditions: [
          { keyword: "WaystoneTier", operator: ">=", value: 15 },
          { keyword: "Class", operator: "==", values: ["Waystones"] }
        ],
        actions: [
          { keyword: "SetTextColor", value: { r: 0, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 235, g: 235, b: 235, a: 255 } },
          { keyword: "PlayAlertSound", id: 5, volume: 300 },
          { keyword: "PlayEffect", color: "White" },
          { keyword: "MinimapIcon", size: 0, color: "White", shape: "Square" }
        ]
      }
    ]
  },
  {
    id: "currency",
    code: "2600",
    title: "Currency - Regular Currency Tiering",
    titleTw: "通貨分級",
    waypoint: "c9.currency.single",
    rules: [
      {
        id: "currency-s-tier",
        sectionId: "currency",
        title: "S-tier currency",
        directive: "Show",
        enabled: true,
        tierTag: "$type->currency $tier->s !apex_stier",
        descriptionTw: "頂級通貨：神聖石、魔鏡、完美通貨等。",
        priority: 99,
        conditions: [
          { keyword: "Class", operator: "==", values: ["Incubators", "Stackable Currency"] },
          { keyword: "BaseType", operator: "==", values: ["Divine Orb", "Mirror of Kalandra", "Perfect Exalted Orb", "Perfect Jeweller's Orb", "Hinekora's Lock"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 45 },
          { keyword: "SetTextColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 6, volume: 300 },
          { keyword: "PlayEffect", color: "Red" },
          { keyword: "MinimapIcon", size: 0, color: "Red", shape: "Star" }
        ]
      },
      {
        id: "currency-b-tier",
        sectionId: "currency",
        title: "B-tier currency",
        directive: "Show",
        enabled: true,
        tierTag: "%H7 $type->currency $tier->b !currency_b",
        descriptionTw: "常見但值得撿的通貨，如混沌石、機會石、崇高石。",
        priority: 82,
        conditions: [
          { keyword: "Class", operator: "==", values: ["Incubators", "Stackable Currency"] },
          { keyword: "BaseType", operator: "==", values: ["Chaos Orb", "Exalted Orb", "Orb of Chance", "Greater Exalted Orb"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 0, g: 0, b: 0, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 245, g: 105, b: 90, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Yellow" },
          { keyword: "MinimapIcon", size: 1, color: "Yellow", shape: "Circle" }
        ]
      }
    ]
  },
  {
    id: "special-currency",
    code: "2700",
    title: "Currency - SPECIAL",
    titleTw: "特殊通貨",
    waypoint: "c10.currency.special",
    rules: [
      {
        id: "special-essences",
        sectionId: "special-currency",
        title: "Essences and catalysts",
        directive: "Show",
        enabled: true,
        tierTag: "$type->currency->essence $tier->valuable !currency_a",
        descriptionTw: "精髓、催化劑、預兆等特殊通貨。",
        priority: 84,
        conditions: [{ keyword: "BaseType", operator: "==", values: ["Greater Essence of Torment", "Catalyst", "Omen of Sinistral Alchemy", "Distilled Fear"] }],
        actions: [
          { keyword: "SetFontSize", value: 42 },
          { keyword: "SetTextColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 245, g: 105, b: 90, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Purple" },
          { keyword: "MinimapIcon", size: 1, color: "Purple", shape: "Circle" }
        ]
      }
    ]
  },
  {
    id: "uniques",
    code: "2900",
    title: "Uniques",
    titleTw: "傳奇物品",
    waypoint: "c11.uniques.all",
    rules: [
      {
        id: "unique-tier-one",
        sectionId: "uniques",
        title: "Tier 1 uniques",
        directive: "Show",
        enabled: true,
        tierTag: "$type->uniques $tier->t1 !apex_stier",
        descriptionTw: "高價傳奇基底，使用頂級高亮。",
        priority: 96,
        conditions: [
          { keyword: "Rarity", values: ["Unique"] },
          { keyword: "BaseType", operator: "==", values: ["Gold Ring", "Golden Charm", "Grand Spear", "Sacrificial Regalia", "Time-Lost Diamond"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 45 },
          { keyword: "SetTextColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 255, g: 0, b: 0, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 6, volume: 300 },
          { keyword: "PlayEffect", color: "Red" },
          { keyword: "MinimapIcon", size: 0, color: "Red", shape: "Star" }
        ]
      }
    ]
  },
  {
    id: "fragments",
    code: "3000",
    title: "Splinters, Tablets, Fragments",
    titleTw: "裂片、碑牌與碎片",
    waypoint: "c12.fragments",
    rules: [
      {
        id: "breach-splinter-stack",
        sectionId: "fragments",
        title: "Splinter stacks",
        directive: "Show",
        enabled: true,
        tierTag: "$type->fragments->generic $tier->stack !fragment_stack",
        descriptionTw: "裂痕與譫妄裂片依堆疊量高亮。",
        priority: 78,
        conditions: [
          { keyword: "StackSize", operator: ">=", value: 2 },
          { keyword: "Class", operator: "==", values: ["Incubators", "Stackable Currency"] },
          { keyword: "BaseType", operator: "==", values: ["Breach Splinter", "Simulacrum Splinter", "Petition Splinter"] }
        ],
        actions: [
          { keyword: "SetFontSize", value: 40 },
          { keyword: "SetTextColor", value: { r: 255, g: 255, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 2, volume: 300 },
          { keyword: "PlayEffect", color: "Purple" },
          { keyword: "MinimapIcon", size: 1, color: "Purple", shape: "Triangle" }
        ]
      }
    ]
  },
  {
    id: "leveling",
    code: "3700",
    title: "Leveling - Useful magic and normal items",
    titleTw: "拓荒可用普通與魔法物品",
    waypoint: "c21.leveling.magicvendor.all",
    rules: [
      {
        id: "leveling-magic-decorator",
        sectionId: "leveling",
        title: "Leveling magic item decorator",
        directive: "Show",
        enabled: true,
        tierTag: "$type->decorators->leveling->magic $tier->largemagic !utility_highlight4",
        descriptionTw: "拓荒階段的魔法裝備裝飾器，使用 Continue 保留後續判斷。",
        priority: 60,
        conditions: [
          { keyword: "Rarity", values: ["Magic"] },
          { keyword: "AreaLevel", operator: "<=", value: 64 },
          { keyword: "Width", operator: ">=", value: 2 },
          { keyword: "Height", operator: ">=", value: 3 }
        ],
        actions: [{ keyword: "SetFontSize", value: 38 }],
        continue: true
      },
      {
        id: "leveling-magic-remaining",
        sectionId: "leveling",
        title: "Leveling magic gear",
        directive: "Show",
        enabled: true,
        tierTag: "%D2 $type->leveling->magic->remaining $tier->rest !gear_vendor",
        descriptionTw: "拓荒中仍可撿取的魔法裝備。",
        priority: 50,
        conditions: [
          { keyword: "Rarity", values: ["Magic"] },
          { keyword: "Class", operator: "==", values: ["Amulets", "Belts", "Body Armours", "Boots", "Bows", "Rings", "Sceptres", "Wands"] },
          { keyword: "AreaLevel", operator: ">=", value: 24 },
          { keyword: "AreaLevel", operator: "<=", value: 64 }
        ],
        actions: [
          { keyword: "SetFontSize", value: 30 },
          { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 0 } },
          { keyword: "SetBackgroundColor", value: { r: 20, g: 20, b: 0, a: 180 } }
        ]
      },
      {
        id: "final-hide-known",
        sectionId: "leveling",
        title: "Hide all known untiered gear",
        directive: "Hide",
        enabled: true,
        tierTag: "$type->hidelayer $tier->final",
        descriptionTw: "最後隱藏所有已知但未被前方規則保留的裝備。",
        priority: 5,
        conditions: [{ keyword: "Class", operator: "==", values: ["Amulets", "Belts", "Body Armours", "Boots", "Bows", "Bucklers", "Charms", "Crossbows", "Foci", "Gloves", "Helmets", "Jewels", "Life Flasks", "Mana Flasks", "One Hand Maces", "Quarterstaves", "Quivers", "Rings", "Sceptres", "Shields", "Spears", "Staves", "Talismans", "Two Hand Maces", "Wands"] }],
        actions: [
          { keyword: "SetFontSize", value: 18 },
          { keyword: "SetBorderColor", value: { r: 0, g: 0, b: 0, a: 0 } },
          { keyword: "SetBackgroundColor", value: { r: 20, g: 20, b: 0, a: 0 } },
          { keyword: "DisableDropSound", value: true }
        ]
      },
      {
        id: "final-show-unknown",
        sectionId: "leveling",
        title: "Show all unknown items",
        directive: "Show",
        enabled: true,
        tierTag: "$type->anyremaining $tier->restex !utility_unknownitem",
        descriptionTw: "安全層：任何未知物品一律紫底青字高亮，避免遊戲改版後漏撿。",
        priority: 1,
        conditions: [],
        actions: [
          { keyword: "SetFontSize", value: 45 },
          { keyword: "SetTextColor", value: { r: 0, g: 255, b: 255, a: 255 } },
          { keyword: "SetBorderColor", value: { r: 0, g: 255, b: 255, a: 255 } },
          { keyword: "SetBackgroundColor", value: { r: 255, g: 0, b: 255, a: 255 } },
          { keyword: "PlayAlertSound", id: 3, volume: 300 },
          { keyword: "PlayEffect", color: "Pink" },
          { keyword: "MinimapIcon", size: 0, color: "Pink", shape: "Pentagon" }
        ]
      }
    ]
  }
];
