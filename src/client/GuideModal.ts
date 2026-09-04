import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { translateText } from "../client/Utils";
import { assetUrl } from "../core/AssetUrls";
import { BaseModal } from "./components/BaseModal";
import { modalHeader } from "./components/ui/ModalHeader";
import {
  cityIcon,
  marauderIcon,
  navalMineIcon,
  samLauncherIcon,
  warshipIcon,
} from "./hud/HotbarIcons";

type GuideSection = {
  id: string;
  tabKey: string;
  titleKey: string;
  icon: string;
  bodyKeys: readonly string[];
};

const SECTIONS: readonly GuideSection[] = [
  {
    id: "navy",
    tabKey: "guide_modal.navy_tab",
    titleKey: "guide_modal.navy_title",
    icon: assetUrl("images/BoatIconWhite.svg"),
    bodyKeys: [
      "guide_modal.navy_closer",
      "guide_modal.navy_shells",
      "guide_modal.navy_burn",
      "guide_modal.navy_buildings",
    ],
  },
  {
    id: "battleship",
    tabKey: "guide_modal.battleship_tab",
    titleKey: "guide_modal.battleship_title",
    icon: warshipIcon,
    bodyKeys: [
      "guide_modal.battleship_stripes",
      "guide_modal.battleship_rank_power",
      "guide_modal.battleship_new_shot",
      "guide_modal.battleship_rank1",
      "guide_modal.battleship_rank2",
      "guide_modal.battleship_rank3_volley",
      "guide_modal.battleship_repair",
      "guide_modal.battleship_guns",
      "guide_modal.battleship_fuse",
      "guide_modal.battleship_no_chase",
      "guide_modal.battleship_bombard",
    ],
  },
  {
    id: "marauder",
    tabKey: "guide_modal.marauder_tab",
    titleKey: "guide_modal.marauder_title",
    icon: marauderIcon,
    bodyKeys: [
      "guide_modal.marauder_cheap",
      "guide_modal.marauder_shot",
      "guide_modal.marauder_range",
    ],
  },
  {
    id: "port-guns",
    tabKey: "guide_modal.port_guns_tab",
    titleKey: "guide_modal.port_guns_title",
    icon: samLauncherIcon,
    bodyKeys: [
      "guide_modal.port_guns_what",
      "guide_modal.port_guns_armor",
      "guide_modal.port_guns_tanky",
      "guide_modal.port_guns_rate",
      "guide_modal.port_guns_l1",
      "guide_modal.port_guns_l4",
      "guide_modal.port_guns_l7",
      "guide_modal.port_guns_l10",
    ],
  },
  {
    id: "mines",
    tabKey: "guide_modal.mines_tab",
    titleKey: "guide_modal.mines_title",
    icon: navalMineIcon,
    bodyKeys: [
      "guide_modal.mines_unlock",
      "guide_modal.mines_place",
      "guide_modal.mines_not_land",
      "guide_modal.mines_cost",
      "guide_modal.mines_extra",
      "guide_modal.mines_max",
      "guide_modal.mines_hidden",
      "guide_modal.mines_team",
      "guide_modal.mines_blow",
      "guide_modal.mines_sink",
      "guide_modal.mines_trade",
    ],
  },
  {
    id: "buildings",
    tabKey: "guide_modal.buildings_tab",
    titleKey: "guide_modal.buildings_title",
    icon: cityIcon,
    bodyKeys: [
      "guide_modal.buildings_smash",
      "guide_modal.buildings_heal",
      "guide_modal.buildings_no_regen",
      "guide_modal.buildings_ports",
      "guide_modal.buildings_chew",
      "guide_modal.buildings_harbor_hp",
      "guide_modal.buildings_rebuild",
    ],
  },
  {
    id: "play",
    tabKey: "guide_modal.play_tab",
    titleKey: "guide_modal.play_title",
    icon: assetUrl("images/PlayIconWhite.svg"),
    bodyKeys: [
      "guide_modal.play_maps",
      "guide_modal.play_ranked",
    ],
  },
];

@customElement("guide-modal")
export class GuideModal extends BaseModal {
  protected routerName = "guide";

  protected modalConfig() {
    return {
      hideTabs: true,
      tabs: SECTIONS.map((section) => ({
        key: section.id,
        label: translateText(section.tabKey),
      })),
    };
  }

  protected renderHeaderSlot() {
    return modalHeader({
      title: translateText("main.guide"),
      onBack: () => this.close(),
      ariaLabel: translateText("common.back"),
      titleClassName: "font-map",
    });
  }

  private renderNav(activeId: string): TemplateResult {
    return html`
      <nav
        class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible shrink-0 lg:w-56 pb-1 lg:pb-0"
        role="tablist"
        aria-label=${translateText("guide_modal.nav_label")}
        data-guide-nav
      >
        ${SECTIONS.map((section) => {
          const active = section.id === activeId;
          return html`
            <button
              type="button"
              role="tab"
              data-guide-nav-item=${section.id}
              aria-selected=${active}
              class="shrink-0 inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${active
                ? "bg-malibu-blue/20 text-aquarius border border-malibu-blue/50"
                : "text-white/50 border border-transparent hover:text-white/80 hover:bg-white/5"}"
              @click=${() => this.setActiveTab(section.id)}
            >
              <img
                src=${section.icon}
                alt=""
                aria-hidden="true"
                class="w-4 h-4 shrink-0 object-contain opacity-90"
                data-guide-tab-icon
              />
              ${translateText(section.tabKey)}
            </button>
          `;
        })}
      </nav>
    `;
  }

  private renderCard(section: GuideSection): TemplateResult {
    return html`
      <article
        class="rounded-xl border border-white/10 bg-white/5 p-5 lg:p-6
          [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2
          [&_li]:text-gray-300 [&_li]:leading-relaxed
          [&_strong]:text-white [&_strong]:font-bold"
        data-guide-section=${section.id}
      >
        <div class="flex items-center gap-3 mb-4">
          <h3
            class="flex items-center gap-2 font-map text-lg lg:text-xl font-bold uppercase tracking-widest text-malibu-blue"
          >
            <img
              src=${section.icon}
              alt=""
              aria-hidden="true"
              class="w-7 h-7 lg:w-8 lg:h-8 shrink-0 object-contain"
              data-guide-title-icon
            />
            ${translateText(section.titleKey)}
          </h3>
          <div
            class="flex-1 h-px bg-gradient-to-r from-[rgba(231,165,40,0.45)] to-transparent"
          ></div>
        </div>
        <ul>
          ${section.bodyKeys.map((key) => html`<li>${translateText(key)}</li>`)}
        </ul>
      </article>
    `;
  }

  protected renderBody(tab: string) {
    const activeId = SECTIONS.some((section) => section.id === tab)
      ? tab
      : SECTIONS[0].id;
    const section =
      SECTIONS.find((entry) => entry.id === activeId) ?? SECTIONS[0];

    return html`
      <div
        class="flex flex-col lg:flex-row gap-4 px-4 lg:px-6 py-3 lg:py-4 min-h-0"
      >
        ${this.renderNav(activeId)}
        <div class="flex-1 min-w-0">${this.renderCard(section)}</div>
      </div>
    `;
  }
}
