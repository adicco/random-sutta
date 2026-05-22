// Path: web/assets/modules/ui/managers/view_manager.js

export const ViewManager = {
    currentView: 'landing', // Initial state

    switchView: function(viewName) {
        this.currentView = viewName;
        return new Promise((resolve) => {
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
                    
                    // Signal that the view is now visible and ready
                    requestAnimationFrame(() => resolve());
                }, 300); // Match CSS transition
            } else if (viewName === 'landing') {
                landing.style.display = 'flex';
                landing.classList.remove("hidden");
                reader.classList.add("hidden");
                if (settings) settings.classList.add("hidden");
                if (edgeLeft) edgeLeft.classList.add("hidden");
                if (edgeRight) edgeRight.classList.add("hidden");
                
                requestAnimationFrame(() => resolve());
            } else {
                resolve();
            }
        });
    },

    hideSplashScreen: function() {
        const splashScreen = document.getElementById("splash-screen");
        if (splashScreen) {
          splashScreen.style.opacity = "0";
          setTimeout(() => {
            splashScreen.remove();
          }, 500);
        }
    }
};
