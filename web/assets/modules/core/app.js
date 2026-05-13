// Path: web/assets/modules/core/app.js
import { Router } from "core/router.js";
import { SuttaController } from "core/sutta_controller.js";
import { SuttaDB } from "data/sutta_db.js";
import { SuttaService, RandomBuffer } from "services/index.js";
import { setupLogging, LogLevel, getLogger } from "utils/logger.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { setupQuickNav } from "ui/components/nav_search.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import {
  DrawerManager,
  OfflineManager,
  ThemeManager,
  FontSizeManager,
  GestureManager,
  BookmarkManager,
  ReadManager,
  SyncUIManager,
} from "ui/managers/index.js";
import { GoogleAuthManager } from "services/sync/google_auth_manager.js";
import { TTSBootstrap } from "tts/tts_bootstrap.js";
import { initLookup } from "lookup/index.js";
import { ToolbarManager } from "toolbar/toolbar_manager.js";

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev-mode";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  // ... (Code giữ nguyên)
  console.time("🚀 App Start to Ready");

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const params = new URLSearchParams(window.location.search);
  const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
  setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

  window.SuttaDB = SuttaDB; 
  window.SuttaController = SuttaController; 
  window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
  window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

  DrawerManager.init();
  ThemeManager.init();
  FontSizeManager.init();
  GestureManager.init();
  BookmarkManager.init();
  ReadManager.init();
  SyncUIManager.init();

  FilterComponent.init();
  initPopupSystem();
  ToolbarManager.init();

  TTSBootstrap.init({
    onAutoNext: async () => {
      logger.info("TTS", "Triggering auto-random...");
      await SuttaController.loadRandomSutta(true);
    },
  });

  setupQuickNav((query) => SuttaController.loadSutta(query));

  const randomBtn = document.getElementById("btn-random");
  const landingRandomBtn = document.getElementById("btn-landing-random"); // [NEW]
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  // [NEW] View Switcher Helper
  const switchView = (viewName) => {
    const landing = document.getElementById("landing-view");
    const reader = document.getElementById("reader-view");
    const settings = document.getElementById("setting-container");
    const edgeLeft = document.getElementById("edge-nav-left");
    const edgeRight = document.getElementById("edge-nav-right");
    
    if (viewName === 'reader') {
        landing.classList.add("hidden");
        // Wait for fade out if needed, or just show reader
        setTimeout(() => {
             landing.style.display = 'none'; // Ensure clicks pass through
             reader.classList.remove("hidden");
             if (settings) settings.classList.remove("hidden");
             if (edgeLeft) edgeLeft.classList.remove("hidden");
             if (edgeRight) edgeRight.classList.remove("hidden");
        }, 300); // Match CSS transition
    } else {
        landing.style.display = 'flex';
        landing.classList.remove("hidden");
        reader.classList.add("hidden");
        if (settings) settings.classList.add("hidden");
        if (edgeLeft) edgeLeft.classList.add("hidden");
        if (edgeRight) edgeRight.classList.add("hidden");
    }
  };

  const hideSplashScreen = () => {
    const splashScreen = document.getElementById("splash-screen");
    if (splashScreen) {
      splashScreen.style.opacity = "0";
      setTimeout(() => {
        splashScreen.remove();
      }, 500);
    }
  };

  // Header Random Button (Reader Mode) - Long Press for Filter
  let isLongPress = false;
  let pressTimer;

  const startPress = (e) => {
    // Only handle left click or touch
    if (e.type === 'mousedown' && e.button !== 0) return;
    
    isLongPress = false;
    pressTimer = setTimeout(() => {
      isLongPress = true;
      const popup = document.getElementById("filter-popup");
      if (popup) {
        popup.style.zIndex = 1150; // Ensure it's above other things
        popup.classList.remove("hidden");
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback on open
      }
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  // Prevent default context menu on mobile long press
  randomBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  
  randomBtn.addEventListener("mousedown", startPress);
  randomBtn.addEventListener("touchstart", startPress, { passive: true });
  randomBtn.addEventListener("mouseup", cancelPress);
  randomBtn.addEventListener("mouseleave", cancelPress);
  randomBtn.addEventListener("touchend", cancelPress);
  randomBtn.addEventListener("touchcancel", cancelPress);

  randomBtn.addEventListener("click", (e) => {
    if (isLongPress) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    SuttaController.loadRandomSutta(true);
  });

  // [NEW] Landing Page Button Listener
  if (landingRandomBtn) {
    landingRandomBtn.addEventListener("click", () => {
      switchView('reader');
      SuttaController.loadRandomSutta(true);
    });
  }

  // [NEW] Save progress on scroll (debounced)
  let scrollSaveTimer = null;
  window.addEventListener("scroll", () => {
    if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
        SuttaController._saveProgress();
    }, 1500);
  }, { passive: true });

  window.addEventListener("beforeunload", () => {
    SuttaController._saveProgress();
  });

  // [FIX] Helper for robust Deep Link parsing
  const processDeepLink = async (urlStr) => {
    logger.info("DeepLink", "Processing: " + urlStr);
    
    // Handle Google Auth Callbacks
    if (urlStr.includes('auth-callback')) {
        GoogleAuthManager.handleNativeCallback(urlStr);
        return;
    }

    try {
        let q = null;
        let hash = "";

        // Attempt 1: Standard URL parsing
        try {
            const url = new URL(urlStr);
            q = url.searchParams.get('q');
            hash = url.hash;
        } catch (e) {}

        // Attempt 2: Manual fallback (resilient to custom scheme parsing quirks)
        if (!q) {
            const qMatch = urlStr.match(/[?&]q=([^&#]+)/);
            if (qMatch) q = decodeURIComponent(qMatch[1]);
            
            const hashMatch = urlStr.match(/#([^?]+)/);
            if (hashMatch) hash = '#' + hashMatch[1];
        }

        if (q) {
            switchView('reader');
            let loadId = q;
            if (hash) loadId += hash;
            
            // Allow a small delay for the view switcher and DB to be ready
            setTimeout(() => {
                SuttaController.loadSutta(loadId, true);
            }, 100);
        }
    } catch (e) {
        logger.error("DeepLink", "Failed to parse app URL: " + urlStr, e);
    }
  };

  // [NEW] Capacitor App Links
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
          App.addListener('appUrlOpen', async data => {
              processDeepLink(data.url);
          });
      }).catch(e => logger.warn("App", "Failed to load Capacitor App plugin", e));
  }

  // [NEW] Tauri Deep Links
  if (window.__TAURI_INTERNALS__) {
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
          onOpenUrl(async (urls) => {
              logger.info("Tauri App", "Tauri deep link opened: " + JSON.stringify(urls));
              for (const urlStr of urls) {
                  processDeepLink(urlStr);
              }
          });
      }).catch(e => logger.warn("Tauri App", "Failed to load Tauri Deep Link plugin", e));
  }

  try {
    console.time("📡 Service Init");
    await SuttaService.init();
    console.timeEnd("📡 Service Init");

    // Deferred heavy initializations to reduce startup concurrency
    initLookup();
    OfflineManager.init();

    if (navHeader) navHeader.classList.remove("hidden");
    randomBtn.disabled = false;
    if (landingRandomBtn) landingRandomBtn.disabled = false;

    const initialParams = Router.getParams();
    
    // [UPDATED] Routing Logic
    if (initialParams.q) {
      // Direct access to a Sutta -> Go to Reader
      switchView('reader');
      
      let loadId = initialParams.q;
      if (window.location.hash) loadId += window.location.hash;
      
      // [NEW] Check if this is the last read sutta to restore scroll position
      let restoreScroll = 0;
      try {
          const saved = localStorage.getItem("last_read_sutta");
          if (saved) {
              const progress = JSON.parse(saved);
              if (progress && progress.id === loadId.split('#')[0]) {
                  restoreScroll = progress.scrollY;
              }
          }
      } catch (e) {}

      console.time("⏱️ Direct Load Total");
      await SuttaController.loadSutta(loadId, true, restoreScroll);
      console.timeEnd("⏱️ Direct Load Total");

      RandomBuffer.startBackgroundWork();
    } else {
      // Root access -> Try restore last read or go to Landing
      const savedProgress = localStorage.getItem("last_read_sutta");
      let restored = false;
      
      if (savedProgress) {
          try {
              const progress = JSON.parse(savedProgress);
              if (progress && progress.id) {
                  switchView('reader');
                  await SuttaController.loadSutta(progress.id, true, progress.scrollY);
                  restored = true;
              }
          } catch (e) {
              console.warn("Restore failed", e);
          }
      }

      if (!restored) {
          switchView('landing');
      }
      
      // Pre-fetch randoms in background while user stares at the landing page (or is reading restored sutta)
      RandomBuffer.startBackgroundWork();
    }

    hideSplashScreen();
    console.timeEnd("🚀 App Start to Ready");
  } catch (err) {
    logger.error("Init", err);
    if (statusDiv) {
      statusDiv.textContent = "Error loading database.";
      statusDiv.style.color = "#ff6b6b";
    }
    hideSplashScreen();
  }

  window.addEventListener("popstate", (event) => {
    const currentParams = Router.getParams();
    const savedScroll =
      event.state && event.state.scrollY ? event.state.scrollY : 0;

    if (currentParams.q) {
      // [FIX] Ensure we are in reader view when popping state to a sutta
      const reader = document.getElementById("reader-view");
      if (reader && reader.classList.contains("hidden")) {
          switchView('reader');
      }

      let loadId = currentParams.q;
      if (window.location.hash) loadId += window.location.hash;
      SuttaController.loadSutta(loadId, false, savedScroll, {
        transition: false,
      });
    } else {
      // If popped back to root -> Show landing?
      // Or load random? 
      // Current UX: Back button at root usually exits app or stays.
      // If we want to support "Back to Landing", we call switchView('landing').
      switchView('landing');
    }
  });
});