// Path: web/assets/modules/core/sutta/loader_ui.js

export const SuttaLoaderUI = {
  _timer: null,
  isLoading: false,

  show() {
    if (this.isLoading) return;
    this.isLoading = true;

    const loader = document.getElementById("sutta-loader");
    const btns = this._getButtons();

    if (this._timer) clearTimeout(this._timer);
    
    // [OPTIMIZATION] Tăng delay lên 400ms để triệt tiêu hoàn toàn nháy (flicker) cho các bài kinh đã cache
    this._timer = setTimeout(() => {
      if (!this.isLoading) return; 

      btns.forEach(btn => { if (btn) btn.disabled = true; });

      if (loader) {
        loader.classList.remove("hidden");
        loader.offsetHeight; // Force reflow
        loader.classList.add("visible");
      }
    }, 400);
  },

  hide() {
    this.isLoading = false;

    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    const loader = document.getElementById("sutta-loader");
    const btns = this._getButtons();

    // Re-enable buttons immediately for responsiveness
    btns.forEach(btn => { if (btn) btn.disabled = false; });

    if (loader) {
      loader.classList.remove("visible");
      // [NEW] Use a stable delay for hiding to match CSS transitions
      setTimeout(() => {
        if (!this.isLoading) {
          loader.classList.add("hidden");
        }
      }, 300);
    }
  },

  _getButtons() {
    return [
      document.getElementById("btn-random"),
      document.getElementById("btn-landing-random"),
      document.getElementById("nav-prev"),
      document.getElementById("nav-next")
    ];
  }
};
