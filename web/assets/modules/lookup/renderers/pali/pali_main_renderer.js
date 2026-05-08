// Path: web/assets/modules/lookup/renderers/pali/pali_main_renderer.js

import { PaliDeconRenderer } from './pali_decon_renderer.js';
import { PaliEntryRenderer } from './pali_entry_renderer.js';
import { PaliRootRenderer } from './pali_root_renderer.js';

export const PaliMainRenderer = {
    renderList(dataList, searchTerm) {
        if (!dataList || !Array.isArray(dataList) || dataList.length === 0) {
            return { dictHtml: "", noteHtml: "" };
        }
        
        let dictHtml = '<div class="dpd-result-list">';

        // 2. Bucketing Logic
        const exactGroup = [];
        const phraseGroup = [];
        const similarGroup = [];

        dataList.forEach((data) => {
            // Prioritize: Exact -> Phrase (Has Word) -> Similar
            if (data.is_exact) {
                exactGroup.push(data);
            } else if (data.has_word) {
                phraseGroup.push(data);
            }
            else {
                similarGroup.push(data);
            }
        });

        // 3. Render Groups
        
        // Exact Matches
        exactGroup.forEach(d => dictHtml += this.render(d, false, d.lookup_key !== searchTerm));

        // Phrases / Compounds
        if (phraseGroup.length > 0) {
            dictHtml += `<div class="dpd-group-header">Phrases</div>`;
            phraseGroup.forEach(d => dictHtml += this.render(d, false, d.lookup_key !== searchTerm));
        }

        // Similar Words
        if (similarGroup.length > 0) {
            dictHtml += `<div class="dpd-group-header">See also</div>`;
            similarGroup.forEach(d => {
                // Pass isSimilar=true to show the matched key
                dictHtml += this.render(d, false, true);
            });
        }
        
        dictHtml += '</div>';

        return { dictHtml, noteHtml: "" };
    },

    render(data, isOpen = false, isSimilar = false) {
        if (!data) return "";
        const { lookup_type, lookup_key, entry_grammar, entry_example, keyMap } = data;
        
        const getAbbr = (fullKey) => keyMap && keyMap.fullToAbbr && keyMap.fullToAbbr[fullKey] 
            ? keyMap.fullToAbbr[fullKey] 
            : fullKey;

        const getLabel = (abbrKey) => keyMap && keyMap.abbrToFull && keyMap.abbrToFull[abbrKey]
            ? keyMap.abbrToFull[abbrKey]
            : abbrKey;
        
        let html = '<div class="dpd-result">';
        
        if (lookup_type === -1 || (data.is_deconstruction === true)) {
            html += PaliDeconRenderer.render(lookup_key, data.meaning);
            
        } else if (lookup_type === 1) {
            const gramObj = this._parse(entry_grammar);
            const exArr = this._parse(entry_example);
            
            html += PaliEntryRenderer.render(data, gramObj, exArr, getAbbr, getLabel, data.headword, isOpen, isSimilar);
            
        } else if (lookup_type === 0) {
            html += PaliRootRenderer.render(data, getLabel);
        }
        
        html += '</div>';
        return html;
    },

    _parse(str) {
        if (!str) return null;
        if (typeof str === 'object') return str;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn("JSON Parse Error", e);
            return null;
        }
    }
};