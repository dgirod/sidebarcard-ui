// ------------------------------------------------------------------------------------------
//  SIDEBAR-CARD (with UI Editor)
// ------------------------------------------------------------------------------------------
//  Based on: https://github.com/DBuit/sidebar-card
//  Extended by: https://github.com/dgirod/sidebarcard
//  Added: Visual UI Editor (getConfigElement)
// ------------------------------------------------------------------------------------------

const SIDEBAR_CARD_TITLE = 'SIDEBAR-CARD-UI';
const SIDEBAR_CARD_VERSION = '1.0.0';

// ##########################################################################################
// ###   Imports
// ##########################################################################################

import { css, html, LitElement } from 'lit-element';
import { moreInfo } from 'card-tools/src/more-info';
import { hass, provideHass } from 'card-tools/src/hass';
import { subscribeRenderTemplate } from 'card-tools/src/templates';
import moment from 'moment/min/moment-with-locales';
import { forwardHaptic, navigate, toggleEntity } from 'custom-card-helpers';

// ##########################################################################################
// ###   The actual Sidebar Card element
// ##########################################################################################

class SidebarCard extends LitElement {
  config: any;
  hass: any;
  shadowRoot: any;
  renderCard: any;
  templateLines: any = [];
  clock = false;
  updateMenu = true;
  digitalClock = false;
  twelveHourVersion = false;
  digitalClockWithSeconds = false;
  period = false;
  date = false;
  dateFormat = 'DD MMMM';
  bottomCard: any = null;
  CUSTOM_TYPE_PREFIX = 'custom:';

  _clockInterval: any = null;
  _dateInterval: any = null;
  _boundLocationChange: any;

  static get properties() {
    return {
      hass: {},
      config: {},
      active: {},
    };
  }

  // --- UI Editor integration ---

  static getConfigElement() {
    return document.createElement('sidebar-card-ui-editor');
  }

  static getStubConfig() {
    return {
      title: 'Meine Sidebar',
      digitalClock: true,
      date: true,
      dateFormat: 'DD MMMM',
    };
  }

  // --- Constructor ---

  constructor() {
    super();
    this._boundLocationChange = () => {
      setTimeout(() => this._updateActiveMenu(), 50);
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('location-changed', this._boundLocationChange);

    const self = this;

    if ((this.config.clock || this.config.digitalClock) && !this._clockInterval) {
      const inc = 1000;
      setTimeout(() => self._runClock(), 50);
      this._clockInterval = setInterval(function () {
        self._runClock();
      }, inc);
    }
    if (this.config.date && !this._dateInterval) {
      const inc = 1000 * 60 * 60;
      setTimeout(() => self._runDate(), 50);
      this._dateInterval = setInterval(function () {
        self._runDate();
      }, inc);
    }

    this._updateActiveMenu();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('location-changed', this._boundLocationChange);
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
    if (this._dateInterval) {
      clearInterval(this._dateInterval);
      this._dateInterval = null;
    }
  }

  // --- Render ---

  render() {
    const sidebarMenu = this.config.sidebarMenu;
    const title = 'title' in this.config ? this.config.title : false;
    const addStyle = 'style' in this.config;

    this.clock = this.config.clock ? this.config.clock : false;
    this.digitalClock = this.config.digitalClock ? this.config.digitalClock : false;
    this.digitalClockWithSeconds = this.config.digitalClockWithSeconds ? this.config.digitalClockWithSeconds : false;
    this.twelveHourVersion = this.config.twelveHourVersion ? this.config.twelveHourVersion : false;
    this.period = this.config.period ? this.config.period : false;
    this.date = this.config.date ? this.config.date : false;
    this.dateFormat = this.config.dateFormat ? this.config.dateFormat : 'DD MMMM';
    this.bottomCard = this.config.bottomCard ? this.config.bottomCard : null;
    this.updateMenu = this.config.hasOwnProperty('updateMenu') ? this.config.updateMenu : true;

    return html`
      ${addStyle
        ? html`
            <style>
              ${this.config.style}
            </style>
          `
        : html``}

      <div class="sidebar-inner">
        ${this.digitalClock
          ? html`
              <h1 class="digitalClock${title ? ' with-title' : ''}${this.digitalClockWithSeconds ? ' with-seconds' : ''}"></h1>
            `
          : html``}
        ${this.clock
          ? html`
              <div class="clock">
                <div class="wrap">
                  <span class="hour"></span>
                  <span class="minute"></span>
                  <span class="second"></span>
                  <span class="dot"></span>
                </div>
              </div>
            `
          : html``}
        ${title
          ? html`
              <h1 class="title">${title}</h1>
            `
          : html``}
        ${this.date
          ? html`
              <h2 class="date"></h2>
            `
          : html``}
        ${sidebarMenu && sidebarMenu.length > 0
          ? html`
              <ul class="sidebarMenu">
                ${(sidebarMenu || [])
                  .filter((item) => this._evaluateVisibleCondition(item.conditional, this.hass))
                  .map((sidebarMenuItem) => {
                    return html`
                      <li
                        @click="${(e) => this._menuAction(e)}"
                        class="${sidebarMenuItem.state &&
                        this.hass.states[sidebarMenuItem.state].state != 'off' &&
                        this.hass.states[sidebarMenuItem.state].state != 'unavailable'
                          ? 'active'
                          : ''}"
                        data-type="${sidebarMenuItem.action}"
                        data-path="${sidebarMenuItem.navigation_path ? sidebarMenuItem.navigation_path : ''}"
                        data-menuitem="${JSON.stringify(sidebarMenuItem)}"
                      >
                        <span>${sidebarMenuItem.name}</span>
                        ${sidebarMenuItem.icon
                          ? html`
                              <ha-icon @click="${(e) => this._menuAction(e)}" icon="${sidebarMenuItem.icon}"></ha-icon>
                            `
                          : html``}
                      </li>
                    `;
                  })}
              </ul>
            `
          : html``}
        ${this.config.template
          ? html`
              <ul class="template">
                ${this.templateLines.map((line) => {
                  return html` ${createElementFromHTML(line)} `;
                })}
              </ul>
            `
          : html``}
        ${this.bottomCard
          ? html`
              <div class="bottom"></div>
            `
          : html``}
      </div>
    `;
  }

  _runClock() {
    let hoursampm;
    let digitalTime;
    const date = new Date();

    let fullHours = date.getHours().toString();
    const realHours = date.getHours();
    const hours = ((realHours + 11) % 12) + 1;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const hour = Math.floor((hours * 60 + minutes) / 2);
    const minute = minutes * 6;
    const second = seconds * 6;

    if (this.clock) {
      this.shadowRoot.querySelector('.hour').style.transform = `rotate(${hour}deg)`;
      this.shadowRoot.querySelector('.minute').style.transform = `rotate(${minute}deg)`;
      this.shadowRoot.querySelector('.second').style.transform = `rotate(${second}deg)`;
    }
    if (this.digitalClock && !this.twelveHourVersion) {
      const minutesString = minutes.toString();
      digitalTime = fullHours.length < 2 ? '0' + fullHours + ':' : fullHours + ':';
      if (this.digitalClockWithSeconds) {
        digitalTime += minutesString.length < 2 ? '0' + minutesString + ':' : minutesString + ':';
        const secondsString = seconds.toString();
        digitalTime += secondsString.length < 2 ? '0' + secondsString : secondsString;
      } else {
        digitalTime += minutesString.length < 2 ? '0' + minutesString : minutesString;
      }
      this.shadowRoot.querySelector('.digitalClock').textContent = digitalTime;
    } else if (this.digitalClock && this.twelveHourVersion && !this.period) {
      hoursampm = date.getHours();
      hoursampm = hoursampm % 12;
      hoursampm = hoursampm ? hoursampm : 12;
      fullHours = hoursampm.toString();
      const minutesString = minutes.toString();
      digitalTime = fullHours.length < 2 ? '0' + fullHours + ':' : fullHours + ':';
      if (this.digitalClockWithSeconds) {
        digitalTime += minutesString.length < 2 ? '0' + minutesString + ':' : minutesString + ':';
        const secondsString = seconds.toString();
        digitalTime += secondsString.length < 2 ? '0' + secondsString : secondsString;
      } else {
        digitalTime += minutesString.length < 2 ? '0' + minutesString : minutesString;
      }
      this.shadowRoot.querySelector('.digitalClock').textContent = digitalTime;
    } else if (this.digitalClock && this.twelveHourVersion && this.period) {
      var ampm = realHours >= 12 ? 'pm' : 'am';
      hoursampm = date.getHours();
      hoursampm = hoursampm % 12;
      hoursampm = hoursampm ? hoursampm : 12;
      fullHours = hoursampm.toString();
      const minutesString = minutes.toString();
      digitalTime = fullHours.length < 2 ? '0' + fullHours + ':' : fullHours + ':';
      if (this.digitalClockWithSeconds) {
        digitalTime += minutesString.length < 2 ? '0' + minutesString + ':' : minutesString + ':';
        const secondsString = seconds.toString();
        digitalTime += secondsString.length < 2 ? '0' + secondsString : secondsString;
      } else {
        digitalTime += minutesString.length < 2 ? '0' + minutesString : minutesString;
      }
      digitalTime += ' ' + ampm;
      this.shadowRoot.querySelector('.digitalClock').textContent = digitalTime;
    }
  }

  _runDate() {
    const now = moment();
    now.locale(this.hass.language);
    this.shadowRoot.querySelector('.date').textContent = now.format(this.dateFormat);
  }

  updateSidebarSize(root) {
    const sidebarInner = this.shadowRoot.querySelector('.sidebar-inner');
    const offParam = getParameterByName('sidebarOff');
    let headerHeightPx = getHeaderHeightPx();

    if (sidebarInner) {
      sidebarInner.style.width = this.offsetWidth + 'px';
      if (this.config.hideTopMenu) {
        sidebarInner.style.height = `${window.innerHeight}px`;
        sidebarInner.style.top = '0px';
      } else {
        sidebarInner.style.height = `calc(${window.innerHeight}px - ` + headerHeightPx + `)`;
        sidebarInner.style.top = headerHeightPx;
      }
    }
  }

  firstUpdated() {
    provideHass(this);
    let root = getRoot();

    const self = this;

    setTimeout(() => {
      self.updateSidebarSize(root);
      self._updateActiveMenu();
    }, 50);

    setTimeout(() => {
      self.updateSidebarSize(root);
    }, 350);

    window.addEventListener(
      'resize',
      function () {
        setTimeout(() => {
          self.updateSidebarSize(root);
        }, 1);
      },
      true
    );

    if (this.bottomCard) {
      setTimeout(() => {
        var card: any = {
          type: this.bottomCard.type,
        };
        card = Object.assign({}, card, this.bottomCard.cardOptions);
        log2console('firstUpdated', 'Bottom card: ', card);
        if (!card || typeof card !== 'object' || !card.type) {
          error2console('firstUpdated', 'Bottom card config error!');
        } else {
          let tag = card.type;
          if (tag.startsWith(this.CUSTOM_TYPE_PREFIX)) tag = tag.substr(this.CUSTOM_TYPE_PREFIX.length);
          else tag = `hui-${tag}-card`;

          const cardElement: any = document.createElement(tag);
          cardElement.setConfig(card);
          cardElement.hass = hass();

          var bottomSection = this.shadowRoot.querySelector('.bottom');
          bottomSection.appendChild(cardElement);
          provideHass(cardElement);

          if (this.bottomCard.cardStyle && this.bottomCard.cardStyle != '') {
            let style = this.bottomCard.cardStyle;
            let itterations = 0;
            let interval = setInterval(function () {
              if (cardElement && cardElement.shadowRoot) {
                window.clearInterval(interval);
                var styleElement = document.createElement('style');
                styleElement.innerHTML = style;
                cardElement.shadowRoot.appendChild(styleElement);
              } else if (++itterations === 10) {
                window.clearInterval(interval);
              }
            }, 100);
          }
        }
      }, 2);
    }
  }

  _updateActiveMenu() {
    if (this.updateMenu) {
      this.shadowRoot.querySelectorAll('ul.sidebarMenu li[data-type="navigate"]').forEach((menuItem) => {
        (menuItem as HTMLElement).classList.remove('active');
      });
      let activeEl = this.shadowRoot.querySelector('ul.sidebarMenu li[data-path="' + document.location.pathname + '"]');
      if (activeEl) {
        (activeEl as HTMLElement).classList.add('active');
      }
    }
  }

  _menuAction(e) {
    if ((e.target.dataset && e.target.dataset.menuitem) || (e.target.parentNode.dataset && e.target.parentNode.dataset.menuitem)) {
      const menuItem = JSON.parse(e.target.dataset.menuitem || e.target.parentNode.dataset.menuitem);
      this._customAction(menuItem);
    }
  }

  _evaluateVisibleCondition(template: string | undefined, hass: any): boolean {
    if (!template) return true;

    const cleaned = template.trim().replace(/^{{\s*|\s*}}$/g, '').trim();

    try {
      const matchState = cleaned.match(/is_state\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/);
      if (matchState) {
        const [_, entityId, expected] = matchState;
        return hass.states[entityId]?.state === expected;
      }

      const matchAttr = cleaned.match(
        /is_state_attr\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/
      );
      if (matchAttr) {
        const [_, entityId, attr, expected] = matchAttr;
        return hass.states[entityId]?.attributes?.[attr] === expected;
      }

      const matchEquals = cleaned.match(/states\[['"]([^'"]+)['"]\]\s*==\s*['"]([^'"]+)['"]/);
      if (matchEquals) {
        const [_, entityId, expected] = matchEquals;
        return hass.states[entityId]?.state === expected;
      }

      const numericMatch = cleaned.match(
        /states\[['"]([^'"]+)['"]\]\s*\|\s*(int|float)\s*([<>]=?|==)\s*([\d.]+)/
      );
      if (numericMatch) {
        const [_, entityId, type, operator, thresholdStr] = numericMatch;
        const raw = hass.states[entityId]?.state;
        if (raw === undefined) return false;
        const num = type === 'float' ? parseFloat(raw) : parseInt(raw, 10);
        const threshold = parseFloat(thresholdStr);

        switch (operator) {
          case '>': return num > threshold;
          case '<': return num < threshold;
          case '>=': return num >= threshold;
          case '<=': return num <= threshold;
          case '==': return num == threshold;
          default: return false;
        }
      }

      console.warn('sidebar-card: could not parse visible template:', cleaned);
      return true;
    } catch (err) {
      console.error('sidebar-card: visible template evaluation error:', err);
      return true;
    }
  }

  _customAction(tapAction) {
    switch (tapAction.action) {
      case 'more-info':
        if (tapAction.entity || tapAction.camera_image) {
          moreInfo(tapAction.entity ? tapAction.entity : tapAction.camera_image!);
        }
        break;
      case 'navigate':
        if (tapAction.navigation_path) {
          navigate(window, tapAction.navigation_path);
        }
        break;
      case 'url':
        if (tapAction.url_path) {
          window.open(tapAction.url_path);
        }
        break;
      case 'toggle':
        if (tapAction.entity) {
          toggleEntity(this.hass, tapAction.entity!);
          forwardHaptic('success');
        }
        break;
      case 'call-service': {
        if (!tapAction.service) {
          forwardHaptic('failure');
          return;
        }
        const [domain, service] = tapAction.service.split('.', 2);
        this.hass.callService(domain, service, tapAction.service_data);
        forwardHaptic('success');
        break;
      }
      case 'service-js':
        if (tapAction.service) {
          try {
            const code = tapAction.service.toString().replace(/^\[\[\[\s*|\s*\]\]\]$/g, '');
            const func = new Function(code);
            func.call(this);
            forwardHaptic('success');
          } catch (err) {
            forwardHaptic('failure');
          }
        } else {
          error2console('service-js', 'no service code found');
        }
        break;
    }
  }

  setConfig(config) {
    this.config = config;

    if (this.config.template) {
      subscribeRenderTemplate(
        null,
        (res) => {
          const regex = /<(?:li|div)(?:\s+(?:class|id)\s*=\s*"([^"]*)")*\s*>([^<]*)<\/(?:li|div)>/g;
          this.templateLines = res.match(regex).map((val) => val);
          this.requestUpdate();
        },
        {
          template: this.config.template,
          variables: { config: this.config },
          entity_ids: this.config.entity_ids,
        }
      );
    }
  }

  getCardSize() {
    return 1;
  }

  static get styles() {
    return css`
      :host {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: var(--sidebar-background, var(--paper-listbox-background-color, var(--primary-background-color, #fff)));
      }
      .sidebar-inner {
        padding: 20px;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        position: fixed;
        width: 0;
        overflow: hidden auto;
      }
      .sidebarMenu {
        list-style: none;
        margin: 20px 0;
        padding: 20px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      .sidebarMenu li {
        color: var(--sidebar-text-color, #000);
        position: relative;
        padding: 10px 20px;
        border-radius: 12px;
        font-size: 18px;
        line-height: 24px;
        font-weight: 300;
        white-space: normal;
        display: block;
        cursor: pointer;
      }
      .sidebarMenu li ha-icon {
        float: right;
        color: var(--sidebar-icon-color, #000);
      }
      .sidebarMenu li.active {
        color: var(--sidebar-selected-text-color);
      }
      .sidebarMenu li.active ha-icon {
        color: var(--sidebar-selected-icon-color, rgb(247, 217, 89));
      }
      .sidebarMenu li.active::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--sidebar-selected-icon-color, #000);
        opacity: 0.12;
        border-radius: 12px;
      }
      h1 {
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 32px;
        line-height: 32px;
        font-weight: 200;
        color: var(--sidebar-text-color, #000);
        cursor: default;
      }
      h1.digitalClock {
        font-size: 60px;
        line-height: 60px;
        cursor: default;
      }
      h1.digitalClock.with-seconds {
        font-size: 48px;
        line-height: 48px;
        cursor: default;
      }
      h1.digitalClock.with-title {
        margin-bottom: 0;
        cursor: default;
      }
      h2 {
        margin: 0;
        font-size: 26px;
        line-height: 26px;
        font-weight: 200;
        color: var(--sidebar-text-color, #000);
        cursor: default;
      }
      .template {
        margin: 0;
        padding: 0;
        list-style: none;
        color: var(--sidebar-text-color, #000);
      }
      .template li {
        display: block;
        color: inherit;
        font-size: 18px;
        line-height: 24px;
        font-weight: 300;
        white-space: normal;
      }
      .clock {
        margin: 20px 0;
        position: relative;
        padding-top: calc(100% - 10px);
        width: calc(100% - 10px);
        border-radius: 100%;
        background: var(--face-color, #fff);
        border: 5px solid var(--face-border-color, #fff);
        box-shadow: inset 2px 3px 8px 0 rgba(0, 0, 0, 0.1);
      }
      .clock .wrap {
        overflow: hidden;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 100%;
      }
      .clock .minute,
      .clock .hour {
        position: absolute;
        height: 28%;
        width: 6px;
        margin: auto;
        top: -27%;
        left: 0;
        bottom: 0;
        right: 0;
        background: var(--clock-hands-color, #000);
        transform-origin: bottom center;
        transform: rotate(0deg);
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.4);
        z-index: 1;
      }
      .clock .minute {
        position: absolute;
        height: 41%;
        width: 4px;
        top: -38%;
        left: 0;
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.4);
        transform: rotate(90deg);
      }
      .clock .second {
        position: absolute;
        top: -48%;
        height: 48%;
        width: 2px;
        margin: auto;
        left: 0;
        bottom: 0;
        right: 0;
        border-radius: 4px;
        background: var(--clock-seconds-hand-color, #ff4b3e);
        transform-origin: bottom center;
        transform: rotate(180deg);
        z-index: 1;
      }
      .clock .dot {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 12px;
        height: 12px;
        border-radius: 100px;
        background: var(--clock-middle-background, #fff);
        border: 2px solid var(--clock-middle-border, #000);
        margin: auto;
        z-index: 1;
      }
      .bottom {
        display: flex;
        margin-top: auto;
      }
    `;
  }
}

customElements.define('sidebar-card-ui', SidebarCard);

// ##########################################################################################
// ###   Visual UI Editor
// ##########################################################################################

class SidebarCardEditor extends LitElement {
  _config: any = {};
  hass: any;
  _activeTab: string = 'general';

  // Native HA card editor (loaded lazily, same trick as vertical-stack-in-card)
  _cardEditorEl: any = null;
  _cardEditorReady: boolean = false;
  _cardEditorLoading: boolean = false;

  static get properties() {
    return {
      hass: { attribute: false },
      _config: { attribute: false },
      _activeTab: {},
      _cardEditorReady: {},
      _cardEditorLoading: {},
    };
  }

  setConfig(config: any): void {
    this._config = { ...config };
    // Sync config to card editor if already ready
    if (this._cardEditorEl && this._cardEditorReady) {
      this._syncToCardEditor();
    }
  }

  // --- Config helpers ---

  private _fireConfigChanged(): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _set(key: string, value: any): void {
    const c = { ...this._config };
    if (value === undefined || value === null || value === '' || value === false) {
      delete c[key];
    } else {
      c[key] = value;
    }
    this._config = c;
    this._fireConfigChanged();
  }

  // --- Tab & toggle handlers ---

  private _selectTab(tab: string): void {
    this._activeTab = tab;
  }

  private _toggleDigitalClock(e: any): void {
    this._set('digitalClock', e.target.checked || undefined);
    if (!e.target.checked) {
      this._set('digitalClockWithSeconds', undefined);
      this._set('twelveHourVersion', undefined);
      this._set('period', undefined);
    }
  }

  private _toggle12Hour(e: any): void {
    this._set('twelveHourVersion', e.target.checked || undefined);
    if (!e.target.checked) {
      this._set('period', undefined);
    }
  }

  private _toggleHideTopMenu(e: any): void {
    this._set('hideTopMenu', e.target.checked || undefined);
    if (!e.target.checked) {
      this._set('showTopMenuOnMobile', undefined);
    }
  }

  // --- Native HA card editor (vertical-stack-in-card approach) ---

  /**
   * Convert our bottomCard config → vertical-stack cards array
   * bottomCard: { type, cardOptions: {...}, cardStyle }
   * HA card:    { type, ...cardOptions }
   */
  private _bottomCardToCards(): any[] {
    const bc = this._config.bottomCard;
    if (!bc || !bc.type) return [];
    return [{ type: bc.type, ...(bc.cardOptions || {}) }];
  }

  /**
   * Convert vertical-stack cards array → our bottomCard config
   * Preserves cardStyle from the existing bottomCard config.
   */
  private _cardsToBottomCard(cards: any[]): any | undefined {
    if (!cards || cards.length === 0) return undefined;
    const { type, ...rest } = cards[0];
    const existingStyle = this._config.bottomCard?.cardStyle;
    return {
      type,
      ...(Object.keys(rest).length > 0 ? { cardOptions: rest } : {}),
      ...(existingStyle ? { cardStyle: existingStyle } : {}),
    };
  }

  private _syncToCardEditor(): void {
    if (!this._cardEditorEl) return;
    try {
      this._cardEditorEl.hass = this.hass;
      this._cardEditorEl.setConfig({
        type: 'vertical-stack',
        cards: this._bottomCardToCards(),
      });
    } catch (_e) {
      // ignore sync errors
    }
  }

  /**
   * Lazily load the native HA vertical-stack card editor.
   * This gives us the full card picker + per-card editing UI for free.
   */
  private async _initCardEditor(): Promise<void> {
    if (this._cardEditorReady || this._cardEditorLoading) return;
    this._cardEditorLoading = true;

    try {
      // Ensure the hui-vertical-stack-card class is available
      let cls: any = customElements.get('hui-vertical-stack-card');
      if (!cls) {
        const helpers = await (window as any).loadCardHelpers();
        helpers.createCardElement({ type: 'vertical-stack', cards: [] });
        await customElements.whenDefined('hui-vertical-stack-card');
        cls = customElements.get('hui-vertical-stack-card');
      }

      // Get the standard HA editor element for vertical-stack cards
      this._cardEditorEl = await cls.getConfigElement();
      this._cardEditorEl.hass = this.hass;

      // Patch setConfig so the editor only sees the cards array (not our full config)
      const originalSetConfig = this._cardEditorEl.setConfig.bind(this._cardEditorEl);
      this._cardEditorEl.setConfig = (cfg: any) => {
        originalSetConfig({
          type: cfg.type || 'vertical-stack',
          cards: cfg.cards || [],
        });
      };

      // Sync current bottomCard config into the editor
      this._syncToCardEditor();

      // Listen for card changes and translate back to our bottomCard format
      this._cardEditorEl.addEventListener('config-changed', (e: CustomEvent) => {
        e.stopPropagation();
        const cards: any[] = e.detail?.config?.cards ?? [];
        const newConfig = { ...this._config };
        const bottomCard = this._cardsToBottomCard(cards);
        if (bottomCard) {
          newConfig.bottomCard = bottomCard;
        } else {
          delete newConfig.bottomCard;
        }
        this._config = newConfig;
        this._fireConfigChanged();
      });

      this._cardEditorReady = true;
      this._cardEditorLoading = false;
    } catch (err) {
      console.error('sidebar-card: failed to init card editor', err);
      this._cardEditorLoading = false;
    }
  }

  // Attach the HA card editor element to our shadow DOM slot after render
  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (this._activeTab === 'card' && this._cardEditorReady && this._cardEditorEl) {
      const slot = this.shadowRoot?.getElementById('card-editor-slot');
      if (slot && !slot.contains(this._cardEditorEl)) {
        slot.appendChild(this._cardEditorEl);
      }
    }
  }

  // --- Render helpers ---

  private _renderGeneralTab() {
    const c = this._config;
    return html`
      <!-- Title -->
      <div class="section">
        <ha-textfield
          label="Titel"
          .value="${c.title || ''}"
          placeholder="Mein Zuhause"
          @change="${(e: any) => this._set('title', e.target.value)}"
        ></ha-textfield>
      </div>

      <!-- Clock -->
      <div class="section-header">Uhr</div>

      <div class="row">
        <span class="label">Digitale Uhr</span>
        <ha-switch .checked="${!!c.digitalClock}" @change="${this._toggleDigitalClock.bind(this)}"></ha-switch>
      </div>

      ${c.digitalClock
        ? html`
            <div class="indent">
              <div class="row">
                <span class="label">Mit Sekunden</span>
                <ha-switch
                  .checked="${!!c.digitalClockWithSeconds}"
                  @change="${(e: any) => this._set('digitalClockWithSeconds', e.target.checked || undefined)}"
                ></ha-switch>
              </div>
              <div class="row">
                <span class="label">12-Stunden Format</span>
                <ha-switch .checked="${!!c.twelveHourVersion}" @change="${this._toggle12Hour.bind(this)}"></ha-switch>
              </div>
              ${c.twelveHourVersion
                ? html`
                    <div class="indent">
                      <div class="row">
                        <span class="label">AM/PM anzeigen</span>
                        <ha-switch
                          .checked="${!!c.period}"
                          @change="${(e: any) => this._set('period', e.target.checked || undefined)}"
                        ></ha-switch>
                      </div>
                    </div>
                  `
                : ''}
            </div>
          `
        : ''}

      <div class="row">
        <span class="label">Analoge Uhr</span>
        <ha-switch .checked="${!!c.clock}" @change="${(e: any) => this._set('clock', e.target.checked || undefined)}"></ha-switch>
      </div>

      <!-- Date -->
      <div class="section-header">Datum</div>

      <div class="row">
        <span class="label">Datum anzeigen</span>
        <ha-switch .checked="${!!c.date}" @change="${(e: any) => this._set('date', e.target.checked || undefined)}"></ha-switch>
      </div>

      ${c.date
        ? html`
            <div class="indent">
              <ha-textfield
                label="Datumsformat"
                .value="${c.dateFormat || 'DD MMMM'}"
                helper="Moment.js Format — z.B. DD MMMM • dddd • DD.MM.YYYY"
                @change="${(e: any) => this._set('dateFormat', e.target.value || 'DD MMMM')}"
              ></ha-textfield>
            </div>
          `
        : ''}

      <!-- Layout -->
      <div class="section-header">Layout</div>

      <div class="row">
        <span class="label">HA Header ausblenden</span>
        <ha-switch .checked="${!!c.hideTopMenu}" @change="${this._toggleHideTopMenu.bind(this)}"></ha-switch>
      </div>

      ${c.hideTopMenu
        ? html`
            <div class="indent">
              <div class="row">
                <span class="label">Auf Mobilgeräten einblenden</span>
                <ha-switch
                  .checked="${!!c.showTopMenuOnMobile}"
                  @change="${(e: any) => this._set('showTopMenuOnMobile', e.target.checked || undefined)}"
                ></ha-switch>
              </div>
            </div>
          `
        : ''}

      <div class="row">
        <span class="label">HA Seitenleiste ausblenden</span>
        <ha-switch
          .checked="${!!c.hideHassSidebar}"
          @change="${(e: any) => this._set('hideHassSidebar', e.target.checked || undefined)}"
        ></ha-switch>
      </div>
    `;
  }

  private _renderBottomCardTab() {
    // Lazily load the HA card editor on first visit
    if (!this._cardEditorReady && !this._cardEditorLoading) {
      this._initCardEditor();
    }

    return html`
      <div class="card-editor-info">
        Wähle eine Karte aus, die am unteren Ende der Sidebar angezeigt wird.
      </div>

      ${this._cardEditorLoading
        ? html`<div class="loading">
            <ha-circular-progress active></ha-circular-progress>
            <span>Lade Karten-Editor…</span>
          </div>`
        : this._cardEditorReady
        ? html`
            <!-- HA native card picker is injected here via updated() -->
            <div id="card-editor-slot"></div>

            <!-- Optional: card style CSS (our custom field below the HA picker) -->
            ${this._config.bottomCard
              ? html`
                  <div class="section-header">Karten-Style (optional)</div>
                  <div class="code-hint">CSS-Regeln für die Bottom Card (z.B. transparenter Hintergrund)</div>
                  <textarea
                    class="code-editor"
                    rows="4"
                    placeholder="ha-card {\n  background: transparent;\n  box-shadow: none;\n}"
                    .value="${this._config.bottomCard?.cardStyle || ''}"
                    @change="${(e: any) => {
                      const newConfig = { ...this._config };
                      if (newConfig.bottomCard) {
                        if (e.target.value) {
                          newConfig.bottomCard = { ...newConfig.bottomCard, cardStyle: e.target.value };
                        } else {
                          const { cardStyle, ...rest } = newConfig.bottomCard;
                          newConfig.bottomCard = rest;
                        }
                        this._config = newConfig;
                        this._fireConfigChanged();
                      }
                    }}"
                  ></textarea>
                `
              : ''}
          `
        : html`<div class="error">Card-Editor konnte nicht geladen werden.</div>`}
    `;
  }

  render() {
    if (!this._config) return html``;

    return html`
      <div class="editor">
        <!-- Tab Navigation -->
        <div class="tabs">
          <button class="tab ${this._activeTab === 'general' ? 'active' : ''}" @click="${() => this._selectTab('general')}">
            Allgemein
          </button>
          <button class="tab ${this._activeTab === 'card' ? 'active' : ''}" @click="${() => this._selectTab('card')}">
            Bottom Card
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">${this._activeTab === 'general' ? this._renderGeneralTab() : this._renderBottomCardTab()}</div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .editor {
        padding: 4px 0;
      }

      /* ---- Tabs ---- */
      .tabs {
        display: flex;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        margin-bottom: 16px;
      }
      .tab {
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        padding: 8px 18px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color, #727272);
        margin-bottom: -1px;
        transition: color 0.15s, border-color 0.15s;
        border-radius: 4px 4px 0 0;
      }
      .tab:hover {
        color: var(--primary-text-color);
        background: rgba(0, 0, 0, 0.04);
      }
      .tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      /* ---- Layout ---- */
      .tab-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .section {
        margin-bottom: 8px;
      }
      .section-header {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--secondary-text-color, #727272);
        margin: 18px 0 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        min-height: 40px;
      }
      .label {
        font-size: 14px;
        color: var(--primary-text-color);
        flex: 1;
        padding-right: 16px;
      }
      .indent {
        padding-left: 20px;
        border-left: 2px solid var(--divider-color, #e0e0e0);
        margin-left: 8px;
        margin-bottom: 4px;
      }

      /* ---- Form elements ---- */
      ha-textfield {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      ha-switch {
        flex-shrink: 0;
      }

      /* ---- Card editor slot ---- */
      #card-editor-slot {
        display: block;
      }
      .card-editor-info {
        font-size: 13px;
        color: var(--secondary-text-color, #727272);
        margin-bottom: 12px;
        line-height: 1.4;
      }
      .loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
        color: var(--secondary-text-color, #727272);
        font-size: 14px;
      }
      .error {
        color: var(--error-color, #f44336);
        font-size: 13px;
        padding: 8px 0;
      }

      /* ---- Card style CSS editor ---- */
      .code-hint {
        font-size: 12px;
        color: var(--secondary-text-color, #727272);
        margin-bottom: 6px;
      }
      .code-editor {
        width: 100%;
        box-sizing: border-box;
        font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.5;
        padding: 10px 12px;
        border: 1px solid var(--input-idle-line-color, rgba(0, 0, 0, 0.38));
        border-radius: 4px;
        background: var(--input-fill-color, rgba(0, 0, 0, 0.04));
        color: var(--primary-text-color);
        resize: vertical;
        transition: border-color 0.2s, background 0.2s;
      }
      .code-editor:focus {
        outline: none;
        border-color: var(--primary-color);
        border-width: 2px;
        background: var(--input-focus-fill-color, rgba(0, 0, 0, 0.06));
      }
    `;
  }
}

customElements.define('sidebar-card-ui-editor', SidebarCardEditor);

// ##########################################################################################
// ###   CSS Helper: Responsive sidebar layout
// ##########################################################################################

function createCSS(sidebarConfig: any, width: number) {
  let sidebarWidth = 25;
  let contentWidth = 75;
  let sidebarResponsive = false;
  let headerHeightPx = getHeaderHeightPx();

  if (sidebarConfig.width) {
    if (typeof sidebarConfig.width == 'number') {
      sidebarWidth = sidebarConfig.width;
      contentWidth = 100 - sidebarWidth;
    } else if (typeof sidebarConfig.width == 'object') {
      sidebarWidth = sidebarConfig.desktop;
      contentWidth = 100 - sidebarWidth;
      sidebarResponsive = true;
    }
  }

  let css = `
    #customSidebarWrapper {
      display:flex;
      flex-direction:row;
      overflow:hidden;
    }
    #customSidebar.hide {
      display:none!important;
      width:0!important;
    }
    #view.hideSidebar {
      width:100%!important;
    }
  `;

  if (sidebarResponsive) {
    const bp = sidebarConfig.breakpoints;
    let activeWidth = sidebarConfig.width.desktop;
    if (width <= bp.mobile) activeWidth = sidebarConfig.width.mobile;
    else if (width <= bp.tablet) activeWidth = sidebarConfig.width.tablet;

    const hidden = activeWidth === 0;
    css += `
      #customSidebar {
        width: ${activeWidth}%;
        overflow: hidden;
        ${hidden ? 'display:none;' : ''}
        ${sidebarConfig.hideTopMenu ? '' : `margin-top: calc(${headerHeightPx} + env(safe-area-inset-top));`}
      }
      #view {
        width: ${100 - activeWidth}%;
        ${sidebarConfig.hideTopMenu ? 'padding-top:0!important;margin-top:0!important;' : ''}
      }
    `;
  } else {
    css += `
      #customSidebar {
        width: ${sidebarWidth}%;
        overflow: hidden;
        ${sidebarConfig.hideTopMenu ? '' : `margin-top: calc(${headerHeightPx} + env(safe-area-inset-top));`}
      }
      #view {
        width: ${contentWidth}%;
        ${sidebarConfig.hideTopMenu ? 'padding-top:0!important;margin-top:0!important;' : ''}
      }
    `;
  }

  return css;
}

// ##########################################################################################
// ###   DOM helpers
// ##########################################################################################

function getLovelace() {
  let root: any = document.querySelector('home-assistant');
  root = root && root.shadowRoot;
  root = root && root.querySelector('home-assistant-main');
  root = root && root.shadowRoot;
  root = root && root.querySelector('ha-drawer partial-panel-resolver');
  root = root && root.shadowRoot || root;
  root = root && root.querySelector('ha-panel-lovelace');
  root = root && root.shadowRoot;
  root = root && root.querySelector('hui-root');
  if (root) {
    const ll = root.lovelace;
    ll.current_view = root.___curView;
    return ll;
  }
  return null;
}

async function log2console(method: string, message: string, object?: any) {
  const lovelace = await getConfig();
  if (lovelace.config.sidebar) {
    const sidebarConfig = Object.assign({}, lovelace.config.sidebar);
    if (sidebarConfig.debug === true) {
      console.info(
        `%c${SIDEBAR_CARD_TITLE}: %c ${method.padEnd(24)} -> %c ${message}`,
        'color: chartreuse; background: black; font-weight: 700;',
        'color: yellow; background: black; font-weight: 700;',
        '',
        object
      );
    }
  }
}

async function error2console(method: string, message: string, object?: any) {
  const lovelace = await getConfig();
  if (lovelace.config.sidebar) {
    const sidebarConfig = Object.assign({}, lovelace.config.sidebar);
    if (sidebarConfig.debug === true) {
      console.error(
        `%c${SIDEBAR_CARD_TITLE}: %c ${method.padEnd(24)} -> %c ${message}`,
        'color: red; background: black; font-weight: 700;',
        'color: white; background: black; font-weight: 700;',
        'color:red',
        object
      );
    }
  }
}

function getRoot() {
  let root: any = document.querySelector('home-assistant');
  root = root && root.shadowRoot;
  root = root && root.querySelector('home-assistant-main');
  root = root && root.shadowRoot;
  root = root && root.querySelector('ha-drawer partial-panel-resolver');
  root = (root && root.shadowRoot) || root;
  root = root && root.querySelector('ha-panel-lovelace');
  root = root && root.shadowRoot;
  root = root && root.querySelector('hui-root');
  return root;
}

function getHeaderHeightPx() {
  let headerHeightPx = '0px';
  const root = getRoot();
  if (!root || !root.shadowRoot) return headerHeightPx;
  const view = root.shadowRoot.getElementById('view');
  if (view !== undefined && window.getComputedStyle(view) !== undefined) {
    headerHeightPx = window.getComputedStyle(view).paddingTop;
  }
  return headerHeightPx;
}

function getSidebar() {
  let sidebar: any = document.querySelector('home-assistant');
  sidebar = sidebar && sidebar.shadowRoot;
  sidebar = sidebar && sidebar.querySelector('home-assistant-main');
  sidebar = sidebar && sidebar.shadowRoot;
  sidebar = sidebar && sidebar.querySelector('ha-drawer ha-sidebar');
  return sidebar;
}

function getAppDrawerLayout() {
  let appDrawerLayout: any = document.querySelector('home-assistant');
  appDrawerLayout = appDrawerLayout && appDrawerLayout.shadowRoot;
  appDrawerLayout = appDrawerLayout && appDrawerLayout.querySelector('home-assistant-main');
  appDrawerLayout = appDrawerLayout && appDrawerLayout.shadowRoot;
  appDrawerLayout = appDrawerLayout && appDrawerLayout.querySelector('ha-drawer');
  appDrawerLayout = appDrawerLayout && appDrawerLayout.shadowRoot;
  appDrawerLayout = appDrawerLayout && appDrawerLayout.querySelector('.mdc-drawer-app-content');
  return appDrawerLayout;
}

function getAppDrawer() {
  let appDrawer: any = document.querySelector('home-assistant');
  appDrawer = appDrawer && appDrawer.shadowRoot;
  appDrawer = appDrawer && appDrawer.querySelector('home-assistant-main');
  appDrawer = appDrawer && appDrawer.shadowRoot;
  appDrawer = appDrawer && appDrawer.querySelector('ha-drawer');
  appDrawer = appDrawer && appDrawer.shadowRoot;
  appDrawer = appDrawer && appDrawer.querySelector('.mdc-drawer');
  return appDrawer;
}

function getParameterByName(name: string, url = window.location.href) {
  const parameterName = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + parameterName + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function updateStyling(appLayout: any, sidebarConfig: any) {
  const width = document.body.clientWidth;
  appLayout.querySelector('#customSidebarStyle').textContent = createCSS(sidebarConfig, width);

  const root = getRoot();
  const hassHeader = root.shadowRoot.querySelector('.header');
  const hassFooter = root.shadowRoot.querySelector('ch-footer') || root.shadowRoot.querySelector('app-footer');
  const offParam = getParameterByName('sidebarOff');
  const view = root.shadowRoot.getElementById('view');
  let headerHeightPx = getHeaderHeightPx();

  if (
    sidebarConfig.hideTopMenu === true &&
    sidebarConfig.showTopMenuOnMobile === true &&
    width <= sidebarConfig.breakpoints.mobile &&
    offParam == null
  ) {
    if (hassHeader) hassHeader.style.display = 'block';
    if (view) view.style.minHeight = `calc(100vh - ${headerHeightPx})`;
    if (hassFooter) hassFooter.style.display = 'flex';
  } else if (sidebarConfig.hideTopMenu === true && offParam == null) {
    if (hassHeader) hassHeader.style.display = 'none';
    if (hassFooter) hassFooter.style.display = 'none';
    if (view) view.style.minHeight = 'calc(100vh)';
  }
}

function subscribeEvents(appLayout: any, sidebarConfig: any, contentContainer: any, sidebar: any) {
  window.addEventListener('resize', function () {
    updateStyling(appLayout, sidebarConfig);
  }, true);

  if ('hideOnPath' in sidebarConfig) {
    window.addEventListener('location-changed', () => {
      if (sidebarConfig.hideOnPath.includes(window.location.pathname)) {
        contentContainer.classList.add('hideSidebar');
        sidebar.classList.add('hide');
      } else {
        contentContainer.classList.remove('hideSidebar');
        sidebar.classList.remove('hide');
      }
    });

    if (sidebarConfig.hideOnPath.includes(window.location.pathname)) {
      contentContainer.classList.add('hideSidebar');
      sidebar.classList.add('hide');
    }
  }
}

function watchLocationChange() {
  setTimeout(() => {
    window.addEventListener('location-changed', () => {
      const root = getRoot();
      if (!root) return;
      const appLayout = root.shadowRoot.querySelector('div');
      const customSidebarWrapper = appLayout.querySelector('#customSidebarWrapper');
      if (!customSidebarWrapper) {
        buildSidebar();
      } else {
        const customSidebar = customSidebarWrapper.querySelector('#customSidebar');
        if (!customSidebar) buildSidebar();
      }
    });
  }, 1000);
}

async function buildCard(sidebar: any, config: any) {
  const sidebarCard = document.createElement('sidebar-card-ui') as any;
  sidebarCard.setConfig(config);
  sidebarCard.hass = hass();
  sidebar.appendChild(sidebarCard);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConfig() {
  let lovelace: any;
  while (!lovelace) {
    lovelace = getLovelace();
    if (!lovelace) await sleep(500);
  }
  return lovelace;
}

function createElementFromHTML(htmlString: string) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

// ##########################################################################################
// ###   Edit Mode – Inline Editor Button & Dialog
// ##########################################################################################

function isEditMode(): boolean {
  return window.location.search.includes('edit=1');
}

function watchEditMode(sidebarConfig: any, sidebar: HTMLElement): void {
  const handler = () => {
    if (isEditMode()) {
      createEditButton(sidebarConfig, sidebar);
    } else {
      removeEditButton(sidebar);
    }
  };
  window.addEventListener('location-changed', handler);
  window.addEventListener('popstate', handler);
  // Deferred initial check: HA may fire location-changed before this listener
  // is registered, so we also check once the event loop is free.
  setTimeout(handler, 0);
}

function createEditButton(sidebarConfig: any, sidebar: HTMLElement): void {
  if (sidebar.querySelector('#sidebarEditBtn')) return;

  const btn = document.createElement('button');
  btn.id = 'sidebarEditBtn';
  btn.title = 'Sidebar bearbeiten';
  btn.innerHTML = `<ha-icon icon="mdi:pencil" style="--mdc-icon-size:18px;"></ha-icon>`;
  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 999;
    background: var(--primary-color, #03a9f4);
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    padding: 0;
  `;
  btn.addEventListener('click', () => openSidebarEditor(sidebarConfig));
  sidebar.appendChild(btn);
}

function removeEditButton(sidebar: HTMLElement): void {
  const btn = sidebar.querySelector('#sidebarEditBtn');
  if (btn) btn.remove();
}

async function openSidebarEditor(currentConfig: any): Promise<void> {
  const lovelace = getLovelace();
  if (!lovelace) return;

  // Backdrop
  const overlay = document.createElement('div');
  overlay.id = 'sidebarEditorOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Panel
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: var(--card-background-color, #1c1c1e);
    border-radius: 12px;
    padding: 0;
    width: 90%;
    max-width: 560px;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
    flex-shrink: 0;
  `;
  const titleEl = document.createElement('span');
  titleEl.textContent = 'Sidebar bearbeiten';
  titleEl.style.cssText = `font-size: 18px; font-weight: 500; color: var(--primary-text-color);`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = `<ha-icon icon="mdi:close" style="--mdc-icon-size:20px;"></ha-icon>`;
  closeBtn.style.cssText = `background:none;border:none;cursor:pointer;color:var(--secondary-text-color);padding:4px;display:flex;`;
  closeBtn.addEventListener('click', () => overlay.remove());

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Editor body (scrollable)
  const body = document.createElement('div');
  body.style.cssText = `padding: 16px 20px; overflow-y: auto; flex: 1;`;

  const editor = document.createElement('sidebar-card-ui-editor') as any;
  editor.hass = hass();
  editor.setConfig({ ...currentConfig });

  let latestConfig = { ...currentConfig };
  editor.addEventListener('config-changed', (e: CustomEvent) => {
    e.stopPropagation();
    latestConfig = { ...e.detail.config };
  });

  body.appendChild(editor);

  // Footer actions
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--divider-color, rgba(255,255,255,0.12));
    flex-shrink: 0;
  `;

  const cancelBtn = document.createElement('mwc-button') as any;
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.addEventListener('click', () => overlay.remove());

  const saveBtn = document.createElement('mwc-button') as any;
  saveBtn.raised = true;
  saveBtn.textContent = 'Speichern';
  saveBtn.addEventListener('click', async () => {
    try {
      const fullConfig = JSON.parse(JSON.stringify(lovelace.config));
      fullConfig.sidebar = latestConfig;
      await lovelace.saveConfig(fullConfig);
      overlay.remove();

      // Re-apply new config to the live sidebar-card-ui element so changes
      // are visible immediately without a page reload.
      const root = getRoot();
      if (root && root.shadowRoot) {
        const appLayout = root.shadowRoot.querySelector('div');
        const sidebarCard: any = appLayout &&
          appLayout.querySelector('#customSidebarWrapper #customSidebar sidebar-card-ui');
        if (sidebarCard) {
          sidebarCard.setConfig(latestConfig);
          sidebarCard.hass = hass();
        }
      }

      showSidebarToast('Sidebar gespeichert ✓');
    } catch (err) {
      console.error('sidebar-card: save failed', err);
      showSidebarToast('Fehler beim Speichern!');
    }
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

function showSidebarToast(message: string): void {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary-color, #03a9f4);
    color: white;
    padding: 10px 24px;
    border-radius: 24px;
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    pointer-events: none;
    transition: opacity 0.4s;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 2400);
  setTimeout(() => toast.remove(), 3000);
}

// ##########################################################################################
// ###   Init
// ##########################################################################################

async function buildSidebar() {
  const lovelace = await getConfig();
  if (lovelace.config.sidebar) {
    const sidebarConfig = Object.assign({}, lovelace.config.sidebar);

    const validWidth =
      !sidebarConfig.width ||
      (typeof sidebarConfig.width == 'number' && sidebarConfig.width > 0 && sidebarConfig.width < 100) ||
      typeof sidebarConfig.width == 'object';

    if (!validWidth) {
      error2console('buildSidebar', 'Error sidebar in width config!');
      return;
    }

    const root = getRoot();
    const hassSidebar = getSidebar();
    const appDrawerLayout = getAppDrawerLayout();
    const appDrawer = getAppDrawer();
    const offParam = getParameterByName('sidebarOff');

    if (!root || !root.shadowRoot) {
      error2console('buildSidebar', 'Root element or shadowRoot not found!');
      return;
    }

    if (sidebarConfig.hideTopMenu === true && offParam == null) {
      if (root.shadowRoot.querySelector('ch-header')) root.shadowRoot.querySelector('ch-header').style.display = 'none';
      if (root.shadowRoot.querySelector('app-header')) root.shadowRoot.querySelector('app-header').style.display = 'none';
      if (root.shadowRoot.querySelector('ch-footer')) root.shadowRoot.querySelector('ch-footer').style.display = 'none';
      if (root.shadowRoot.getElementById('view')) root.shadowRoot.getElementById('view').style.minHeight = 'calc(100vh)';
    }

    if (sidebarConfig.hideHassSidebar === true && offParam == null) {
      if (hassSidebar) hassSidebar.style.display = 'none';
      if (appDrawerLayout) {
        appDrawerLayout.style.marginLeft = '0';
        appDrawerLayout.style.paddingLeft = '0';
      }
      if (appDrawer) appDrawer.style.display = 'none';
    }

    if (!sidebarConfig.breakpoints) {
      sidebarConfig.breakpoints = { tablet: 1024, mobile: 768 };
    } else {
      if (!sidebarConfig.breakpoints.mobile) sidebarConfig.breakpoints.mobile = 768;
      if (!sidebarConfig.breakpoints.tablet) sidebarConfig.breakpoints.tablet = 1024;
    }

    let appLayout = root.shadowRoot.querySelector('div');
    let css = createCSS(sidebarConfig, document.body.clientWidth);
    let style: any = document.createElement('style');
    style.setAttribute('id', 'customSidebarStyle');
    appLayout.appendChild(style);
    style.type = 'text/css';
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    let contentContainer = appLayout.querySelector('#view');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('id', 'customSidebarWrapper');
    contentContainer.parentNode.insertBefore(wrapper, contentContainer);

    let sidebar = document.createElement('div');
    sidebar.setAttribute('id', 'customSidebar');
    wrapper.appendChild(sidebar);
    wrapper.appendChild(contentContainer);

    await buildCard(sidebar, sidebarConfig);
    subscribeEvents(appLayout, sidebarConfig, contentContainer, sidebar);

    setTimeout(function () {
      updateStyling(appLayout, sidebarConfig);
    }, 1);

    // Edit-mode button: visible only when dashboard is in edit mode
    sidebar.style.position = 'relative';
    if (isEditMode()) createEditButton(sidebarConfig, sidebar);
    watchEditMode(sidebarConfig, sidebar);
  } else {
    log2console('buildSidebar', 'No sidebar in config found!');
  }
}

console.info(
  `%c  ${SIDEBAR_CARD_TITLE.padEnd(24)}%c\n  Version: ${SIDEBAR_CARD_VERSION.padEnd(16)}`,
  'color: chartreuse; background: black; font-weight: 700;',
  'color: white; background: dimgrey; font-weight: 700;'
);

buildSidebar();
watchLocationChange();
