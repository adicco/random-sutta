// Path: web/assets/modules/core/router.js

export const Router = {
  // Giữ nguyên tham số enableRandomMode để tránh lỗi gọi hàm, nhưng sẽ ignore nó trong logic
  updateURL: function (suttaId, bookParam, enableRandomMode = false, explicitHash = null, savedScrollPosition = null, options = {}) {
    try {
      const currentScrollY = (savedScrollPosition !== null) ? savedScrollPosition : (window.scrollY || 0);
      
      const currentState = window.history.state || {};
      
      window.history.replaceState(
          { ...currentState, scrollY: currentScrollY }, 
          "", 
          window.location.href
      );
    } catch (e) {
      console.warn("Could not save scroll position:", e);
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const currentSuttaId = params.get("q");

      params.delete("r");
      if (suttaId) {
        params.set("q", suttaId);
      }

      if (bookParam) {
        params.set("b", bookParam);
      } else {
        params.delete("b");
      }

      // [NEW] Handle highlight parameter
      if (options.hl) {
          params.set("hl", options.hl);
      } else if (!suttaId || suttaId !== currentSuttaId) {
          params.delete("hl");
      }

      let hash = "";
      if (explicitHash) {
          hash = explicitHash.startsWith("#") ? explicitHash : `#${explicitHash}`;
      } else if (suttaId === currentSuttaId && window.location.hash) {
          hash = window.location.hash;
      }

      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      const stateId = suttaId || params.get("q");

      const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      
      if (newUrl !== currentRelativeUrl) {
         if (options.replace) {
             window.history.replaceState({ ...window.history.state, suttaId: stateId, scrollY: 0 }, "", newUrl);
         } else {
             window.history.pushState({ suttaId: stateId, scrollY: 0 }, "", newUrl);
         }
      }
    } catch (e) {
      console.warn("Router Error:", e);
    }
  },

  getParams: function () {
    const p = new URLSearchParams(window.location.search);
    return {
      q: p.get("q"),
      r: p.get("r"),
      b: p.get("b"),
      hl: p.get("hl"), // [NEW]
    };
  },
};