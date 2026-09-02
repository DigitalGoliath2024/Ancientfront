import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("main-layout")
export class MainLayout extends LitElement {
  private _initialChildren: Node[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    if (this._initialChildren.length === 0 && this.childNodes.length > 0) {
      this._initialChildren = Array.from(this.childNodes);
    }
    super.connectedCallback();
  }

  render() {
    return html`
      <main
        class="relative [.in-game_&]:hidden flex flex-col flex-1 min-h-0 w-full px-0 lg:px-[clamp(1.5rem,3vw,3rem)] pt-0 lg:pt-2 pb-0 lg:pb-1 overflow-hidden"
      >
        <div
          class="w-full lg:max-w-[min(96vw,1680px)] mx-auto flex flex-col flex-1 min-h-0 gap-0 overflow-x-clip sm:px-4 lg:px-0"
        >
          ${this._initialChildren}
        </div>
      </main>
    `;
  }
}
