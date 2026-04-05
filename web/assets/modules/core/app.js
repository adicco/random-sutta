// Path: web/assets/modules/core/app.js
import { Router } from "core/router.js";
import { SuttaController } from "core/sutta_controller.js";
import { SuttaService, RandomBuffer } from "services/index.js";
import { setupLogging, LogLevel, getLogger } from "utils/logger.js";
import { FilterComponent } from "ui/components/filters/index.js";
import { setupQuickNav } from "ui/components/search.js";
import { initPopupSystem } from "ui/components/popup/index.js";
import {
  DrawerManager,
  OfflineManager,
  ThemeManager,
  FontSizeManager,
} from "ui/managers/index.js";
import { TTSBootstrap } from "tts/tts_bootstrap.js";
import { initLookup } from "lookup/index.js";

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : "dev-mode";
const logger = getLogger("App");

document.addEventListener("DOMContentLoaded", async () => {
  // ... (Code giữ nguyên)
  console.time("🚀 App Start to Ready");

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const params = new URLSearchParams(window.location.search);
  const isDebug = params.get("debug") === "1" || params.get("debug") === "true";
  setupLogging({ level: isDebug ? LogLevel.DEBUG : LogLevel.INFO });

  DrawerManager.init();
  OfflineManager.init();
  ThemeManager.init();
  FontSizeManager.init();
  GestureManager.init();

  FilterComponent.init();
  initPopupSystem();
  initLookup();

  TTSBootstrap.init({
    onAutoNext: async () => {
      logger.info("TTS", "Triggering auto-random...");
      await SuttaController.loadRandomSutta(true);
    },
  });

  setupQuickNav((query) => SuttaController.loadSutta(query));

  window.loadSutta = (id, u, s, o) => SuttaController.loadSutta(id, u, s, o);
  window.triggerRandomSutta = () => SuttaController.loadRandomSutta(true);

  const randomBtn = document.getElementById("btn-random");
  const landingRandomBtn = document.getElementById("btn-landing-random"); // [NEW]
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  // [NEW] View Switcher Helper
  const switchView = (viewName) => {
    const landing = document.getElementById("landing-view");
    const reader = document.getElementById("reader-view");
    const filter = document.getElementById("filter-container");
    
    if (viewName === 'reader') {
        landing.classList.add("hidden");
        // Wait for fade out if needed, or just show reader
        setTimeout(() => {
             landing.style.display = 'none'; // Ensure clicks pass through
             reader.classList.remove("hidden");
             if (filter) filter.classList.remove("hidden");
        }, 300); // Match CSS transition
    } else {
        landing.style.display = 'flex';
        landing.classList.remove("hidden");
        reader.classList.add("hidden");
        if (filter) filter.classList.add("hidden");
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

  // Header Random Button (Reader Mode)
  randomBtn.addEventListener("click", () =>
    SuttaController.loadRandomSutta(true)
  );

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

  // [NEW] Landing Random Button
  if (landingRandomBtn) {
      landingRandomBtn.addEventListener("click", async () => {
          // Switch view immediately to feel responsive (or show loader?)
          // Better: Load first then switch? Or Switch then load?
          // Let's switch then load to show the reader UI skeleton.
          switchView('reader');
          await SuttaController.loadRandomSutta(true);
      });
  }

  try {
    console.time("📡 Service Init");
    await SuttaService.init();
    console.timeEnd("📡 Service Init");

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