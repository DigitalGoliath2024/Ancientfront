import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../resources/lang/en.json";
import { GuideModal } from "../../src/client/GuideModal";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => {
    const parts = key.split(".");
    let cur: unknown = en;
    for (const part of parts) {
      if (cur === null || typeof cur !== "object" || !(part in cur)) {
        return key;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : key;
  },
}));

const SECTION_IDS = [
  "navy",
  "battleship",
  "marauder",
  "port-guns",
  "mines",
  "buildings",
  "play",
] as const;

const FORBIDDEN_MINE_COPY = /search|sweep|blast radius/i;

const TITLE_ICONS: Record<(typeof SECTION_IDS)[number], string> = {
  navy: "NavyIconWhite",
  battleship: "WarshipIconWhite",
  marauder: "MarauderIconWhite",
  "port-guns": "PortGunIconWhite",
  mines: "NavalMineIconWhite",
  buildings: "CityIconWhite",
  play: "PlayIconWhite",
};

afterEach(() => document.body.replaceChildren());

async function mountGuide(): Promise<GuideModal> {
  if (!customElements.get("guide-modal")) {
    customElements.define("guide-modal", GuideModal);
  }
  const modal = document.createElement("guide-modal") as GuideModal;
  modal.setAttribute("inline", "");
  document.body.appendChild(modal);
  await modal.updateComplete;
  return modal;
}

describe("Guide modal", () => {
  it("uses the approved Guide title and a jumpable card per topic", async () => {
    expect(en.main.guide).toBe("Guide");

    const modal = await mountGuide();
    const text = modal.textContent ?? "";

    expect(text).toContain("Guide");
    expect(text).toContain("Navy");
    expect(text).toContain("Battleship");
    expect(text).toContain("Marauder");
    expect(text).toContain("Port guns");
    expect(text).toContain("Mines");
    expect(text).toContain("Buildings");
    expect(text).toContain("Play");

    const nav = modal.querySelector("[data-guide-nav]");
    expect(nav).toBeTruthy();
    const navItems = [
      ...modal.querySelectorAll("[data-guide-nav-item]"),
    ].map((el) => el.getAttribute("data-guide-nav-item"));
    expect(navItems).toEqual([...SECTION_IDS]);

    expect(modal.querySelector('[data-guide-section="navy"]')).toBeTruthy();
    expect(text).toContain("shoot closer than in OpenFront");
    expect(text).toContain("do not chase forever");
    expect(text).toContain("shell buildings");
    expect(modal.querySelector('[data-guide-section="mines"]')).toBeNull();
  });

  it("switches to one card at a time from the section nav", async () => {
    const modal = await mountGuide();

    modal.setActiveTab("battleship");
    await modal.updateComplete;
    expect(modal.querySelector('[data-guide-section="battleship"]')).toBeTruthy();
    expect(modal.textContent).toContain("Gold stripes are rank");
    expect(modal.textContent).toContain("three heavy shots each time it fires");
    expect(modal.textContent).toContain("Rank 3 repairs the hull slowly");
    expect(modal.textContent).toContain("85 tiles");
    expect(modal.querySelector('[data-guide-section="navy"]')).toBeNull();

    const minesButton = modal.querySelector(
      '[data-guide-nav-item="mines"]',
    ) as HTMLButtonElement;
    minesButton.click();
    await modal.updateComplete;
    expect(modal.querySelector('[data-guide-section="mines"]')).toBeTruthy();
    expect(modal.querySelector('[data-guide-section="battleship"]')).toBeNull();
  });

  it("covers play-relevant facts on their cards", async () => {
    const modal = await mountGuide();

    modal.setActiveTab("marauder");
    await modal.updateComplete;
    expect(modal.textContent).toContain("weaker hull");
    expect(modal.textContent).toContain("one shot");

    modal.setActiveTab("port-guns");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Shore batteries");
    expect(modal.textContent).toContain("fire slower than a battleship");
    expect(modal.textContent).toContain("tanky");
    expect(modal.textContent).toContain("Level 1");
    expect(modal.textContent).toContain("1,000 HP");
    expect(modal.textContent).toContain("Level 4");
    expect(modal.textContent).toContain("Repairman");
    expect(modal.textContent).toContain("Level 7");
    expect(modal.textContent).toContain("three shells");
    expect(modal.textContent).toContain("Level 10");
    expect(modal.textContent).toContain("113");

    modal.setActiveTab("buildings");
    await modal.updateComplete;
    expect(modal.textContent).toContain("target and destroy buildings");
    expect(modal.textContent).toContain(
      "port gun is the only building that starts healing at level 4",
    );
    expect(modal.textContent).toContain("do not regenerate");
    expect(modal.textContent).toContain("no Repairman");
    expect(modal.textContent).toContain("chew its levels first");
    expect(modal.textContent).toContain("health bar appears");
    expect(modal.textContent).toContain("rebuild");

    modal.setActiveTab("play");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Cosmic and tournament");
    expect(modal.textContent).toContain("coming soon");
    expect(modal.textContent).not.toContain("lobby cards");
    expect(modal.textContent).not.toContain("OpenFront account");
    expect(modal.textContent).not.toContain("store");
  });

  it("mines card explains unlock, place, cost, and hits without design-doc negatives", async () => {
    const modal = await mountGuide();
    modal.setActiveTab("mines");
    await modal.updateComplete;

    const card = modal.querySelector('[data-guide-section="mines"]');
    expect(card).toBeTruthy();
    const text = card?.textContent ?? "";

    expect(text).toContain("Armory 4");
    expect(text).toContain("$2,000,000");
    expect(text).toContain("right-click water");
    expect(text).toContain("land build menu");
    expect(text).toContain("$250k");
    expect(text).toContain("$500k");
    expect(text).toContain("3");
    expect(text).toContain("Enemies cannot see them");
    expect(text).toContain("hurt badly");
    expect(text).toContain("sink");
    expect(text).toContain("Trade ships ignore");
    expect(text).not.toMatch(FORBIDDEN_MINE_COPY);

    const mineCopy = Object.entries(en.guide_modal)
      .filter(([key]) => key.startsWith("mines_"))
      .map(([, value]) => value)
      .join("\n");
    expect(mineCopy).not.toMatch(FORBIDDEN_MINE_COPY);
  });

  it("puts the matching in-game icon before each title and uses bullets", async () => {
    const modal = await mountGuide();

    const tabIcons = [
      ...modal.querySelectorAll("[data-guide-nav-item] [data-guide-tab-icon]"),
    ] as HTMLImageElement[];
    expect(tabIcons.map((img) => img.getAttribute("src") ?? "")).toEqual(
      SECTION_IDS.map((id) => expect.stringContaining(TITLE_ICONS[id])),
    );

    for (const id of SECTION_IDS) {
      modal.setActiveTab(id);
      await modal.updateComplete;

      const card = modal.querySelector(`[data-guide-section="${id}"]`);
      expect(card).toBeTruthy();

      const icon = card?.querySelector(
        "[data-guide-title-icon]",
      ) as HTMLImageElement | null;
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("src") ?? "").toContain(TITLE_ICONS[id]);

      const items = card?.querySelectorAll("ul > li") ?? [];
      expect(items.length).toBeGreaterThan(0);
      expect(card?.querySelector("p")).toBeNull();
    }

    expect(modal.querySelector("[data-guide-nav]")).toBeTruthy();
  });
});
