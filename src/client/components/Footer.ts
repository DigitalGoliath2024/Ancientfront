import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import version from "resources/version.txt?raw";
import { assetUrl } from "../../core/AssetUrls";
import { composeVersionDisplay, desktopVersion } from "../DesktopShell";

const gameVersion = (() => {
  const trimmed = version.trim();
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
})();

@customElement("page-footer")
export class Footer extends LitElement {
  @state() private versionLabel = gameVersion;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void desktopVersion().then((shellVersion) => {
      this.versionLabel = composeVersionDisplay(gameVersion, shellVersion);
    });
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-black flex items-center justify-between gap-3 px-3 lg:px-6 py-1.5 text-white/50 w-full border-t border-white/10 shrink-0 relative z-50"
      >
        <img
          src=${assetUrl("images/GameLogo.jpg")}
          alt="Marauder's Sea"
          class="h-9 lg:h-11 w-auto max-w-[42%] object-contain shrink-0"
        />

        <div
          class="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-[11px] lg:text-xs min-w-0"
        >
          <a
            href="https://github.com/DigitalGoliath2024/Ancientfront"
            target="_blank"
            rel="noopener noreferrer"
            class="opacity-60 hover:opacity-100 hover:scale-110 transition-all shrink-0"
          >
            <img
              src=${assetUrl("icons/github-mark-white.svg")}
              data-i18n-alt="main.github"
              class="h-5 w-5 object-contain pointer-events-none"
              draggable="false"
            />
          </a>
          <span class="footer-version whitespace-nowrap"
            >${this.versionLabel}</span
          >
          <span class="whitespace-nowrap" data-i18n="main.copyright"></span>
          <span class="whitespace-nowrap" data-i18n="main.based_on"></span>
          <a
            href="/terms-of-service.html"
            data-i18n="main.terms_of_service"
            target="_blank"
            class="hover:text-white transition-colors whitespace-nowrap"
          ></a>
          <a
            href="/privacy-policy.html"
            data-i18n="main.privacy_policy"
            target="_blank"
            class="hover:text-white transition-colors whitespace-nowrap"
          ></a>
          <a
            href="https://github.com/DigitalGoliath2024/Ancientfront/blob/main/CREDITS.md"
            data-i18n="game_starting_modal.credits"
            target="_blank"
            class="hover:text-white transition-colors whitespace-nowrap"
          ></a>
          <lang-selector class="shrink-0"></lang-selector>
        </div>
      </footer>
    `;
  }
}
