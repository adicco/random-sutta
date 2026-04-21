// Path: web/assets/modules/lookup/renderers/pali/pali_decon_renderer.js

export const PaliDeconRenderer = {
    render(word, componentsStr) {
        if (!componentsStr) {
             return `
            <div class="dpd-deconstruction">
                <p class="decon-key"><b>${word}</b></p>
            </div>`;
        }

        let rows = [];
        try {
            // New Format: CSV String "part1+part2,part3+part4"
            if (componentsStr.includes(',') || componentsStr.includes('+')) {
                rows = componentsStr.split(',');
            } else {
                // Single item fallback
                rows = [componentsStr];
            }
        } catch (e) {
            console.warn("Decon Parse Error", e);
            return "";
        }

        if (rows.length === 0) return "";

        let html = `
        <div class="dpd-deconstruction">
            <div class="dpd-summary-line-1">
                <span class="decon-key">${word}</span>
                <span class="dpd-pos">deconstruction</span>
            </div>
            <table class="dpd-deconstruction-table">`;
        
        rows.forEach(rowStr => {
            const parts = rowStr.split('+');
            if (parts.length === 0) return;
            
            html += `<tr>`;
            parts.forEach((part, index) => {
                const cleanPart = part.trim();
                // Granularly wrap Pāli words to allow individual lookups
                const wrappedPart = cleanPart.replace(/[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑṬḌṆḶṂṀ]+|\>/g, (match) => {
                    if (match === '>') {
                        return `<span class="dpd-operator">${match}</span>`;
                    }
                    return `<span class="dpd-construction-item clickable" data-lookup="${match}">${match}</span>`;
                });
                html += `<td class="decon-cell">${wrappedPart}</td>`;
                if (index < parts.length - 1) {
                    html += `<td class="decon-plus"><span class="dpd-operator">+</span></td>`;
                }
            });
            html += `</tr>`;
        });

        html += `</table></div>`;
        return html;
    }
};