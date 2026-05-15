// Path: web/assets/modules/ui/managers/tooltip_manager.js
import { TOOLTIP_DATA } from "data/tooltips.js";
import { getLogger } from "utils/logger.js";

const logger = getLogger("TooltipManager");

export const TooltipManager = {
    tooltipEl: null,
    activeTrigger: null,

    init() {
        this._createTooltipElement();
        this._attachGlobalListeners();
        logger.info("Init", "TooltipManager initialized.");
    },

    _createTooltipElement() {
        if (this.tooltipEl) return;
        this.tooltipEl = document.createElement("div");
        this.tooltipEl.className = "global-tooltip";
        document.body.appendChild(this.tooltipEl);
    },

    _attachGlobalListeners() {
        // Use event delegation for tooltips
        document.addEventListener("mouseover", (e) => {
            const trigger = e.target.closest("[data-tooltip-id]");
            if (trigger) {
                this.show(trigger);
            }
        });

        document.addEventListener("mouseout", (e) => {
            const trigger = e.target.closest("[data-tooltip-id]");
            if (trigger && this.activeTrigger === trigger) {
                this.hide();
            }
        });

        // Also show on click for mobile/accessibility
        document.addEventListener("click", (e) => {
            const trigger = e.target.closest("[data-tooltip-id]");
            if (trigger) {
                e.stopPropagation();
                if (this.activeTrigger === trigger && this.tooltipEl.classList.contains("visible")) {
                    this.hide();
                } else {
                    this.show(trigger);
                }
            } else {
                this.hide();
            }
        });

        window.addEventListener("scroll", () => this.hide(), { passive: true });
    },

    show(trigger) {
        const tooltipId = trigger.getAttribute("data-tooltip-id");
        const content = TOOLTIP_DATA[tooltipId];
        
        if (!content) return;

        this.activeTrigger = trigger;
        this.tooltipEl.textContent = content;
        this.tooltipEl.classList.add("visible");

        this._positionTooltip(trigger);
    },

    hide() {
        if (this.tooltipEl) {
            this.tooltipEl.classList.remove("visible");
            this.activeTrigger = null;
        }
    },

    _positionTooltip(trigger) {
        const rect = trigger.getBoundingClientRect();
        const tooltipRect = this.tooltipEl.getBoundingClientRect();
        
        let top = rect.top - tooltipRect.height - 10;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        
        // Horizontal bounds check
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        // Vertical bounds check (if top is too high, show below)
        if (top < 10) {
            top = rect.bottom + 10;
            this.tooltipEl.classList.remove("pos-top");
            this.tooltipEl.classList.add("pos-bottom");
        } else {
            this.tooltipEl.classList.remove("pos-bottom");
            this.tooltipEl.classList.add("pos-top");
        }

        this.tooltipEl.style.top = `${top}px`;
        this.tooltipEl.style.left = `${left}px`;
    }
};
