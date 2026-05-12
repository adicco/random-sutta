// Path: web/assets/modules/ui/components/filters/index.js
import { Router } from 'core/router.js';
import { FilterState } from './filter_state.js';
import { FilterView } from './filter_view.js';
import { FilterGestures } from './filter_gestures.js';

export const FilterComponent = {
    init() {
        const params = Router.getParams();
        FilterState.initFromUrl(params.b);

        const handleToggleVisual = (bookId, forcedState) => {
            if (forcedState) FilterState.add(bookId);
            else FilterState.delete(bookId);
            
            FilterView.updateBtnState(bookId, forcedState);
        };

        const handleDragEnd = () => {
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
        };

        const handleSolo = (bookId) => {
            FilterState.setSolo(bookId);
            FilterView.updateAllStates(FilterState); 
            
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
            
            if (navigator.vibrate) navigator.vibrate(50);
        };

        FilterGestures.initGlobalHandlers(handleToggleVisual, handleDragEnd);

        FilterView.render(
            {
                primary: "primary-filters",
                secondary: "secondary-filters",
                moreBtn: "btn-more-filters"
            },
            FilterState,
            {
                attachGestures: (btn, bookId) => {
                    FilterGestures.attachToButton(
                        btn, 
                        bookId, 
                        (bid) => FilterState.has(bid),
                        handleToggleVisual,
                        handleSolo
                    );
                }
            }
        );

        // [NEW] Close logic for filter popup
        const filterPopup = document.getElementById("filter-popup");
        const closeBtn = document.getElementById("close-filter-popup");
        if (filterPopup && closeBtn) {
            closeBtn.addEventListener("click", () => {
                filterPopup.classList.add("hidden");
            });

            // Click outside to close (optional, if we want typical popup behavior)
            filterPopup.addEventListener("click", (e) => {
                if (e.target === filterPopup) {
                    filterPopup.classList.add("hidden");
                }
            });
        }
    },

    getActiveFilters: () => FilterState.getActiveList(),
    generateBookParam: () => FilterState.generateParam()
};