// Path: web/assets/modules/lookup/renderers/pali/pali_entry_renderer.js

export const PaliEntryRenderer = {
    render(data, _gram, _examples, getAbbr, getLabel, headword, isOpen, isSimilar = false) {
        // Read directly from flattened object
        const pos = data.pos || '';
        const meaning = data.meaning || '';
        const plusCase = data.plus_case || '';
        const meaningLit = data.meaning_lit || '';
        const construction = data.construction || '';
        const degree = data.degree || '';
        
        // Flattened Fields
        const grammar = data.grammar;
        const rootFamily = data.root_family;
        const rootInfo = data.root_info;
        const rootInSandhi = data.root_in_sandhi;
        const base = data.base;
        const derivative = data.derivative;
        const phonetic = data.phonetic;
        const compound = data.compound;
        const antonym = data.antonym;
        const synonym = data.synonym;
        const variant = data.variant;
        const commentary = data.commentary;
        const notes = data.notes;
        const cognate = data.cognate;
        const link = data.link;
        const nonIa = data.non_ia;
        const sanskrit = data.sanskrit;
        const sanskritRoot = data.sanskrit_root;
        const example1 = data.example_1;
        const example2 = data.example_2;

        // Parse Inflection Info & Group by Gender/Person
        let inflectionHtmlContent = '';
        if (data.inflection_map) {
            try {
                const mapData = typeof data.inflection_map === 'string' 
                    ? JSON.parse(data.inflection_map) 
                    : data.inflection_map;
                    
                if (Array.isArray(mapData) && mapData.length > 0) {
                    const groupKeys = ['masc', 'nt', 'neut', 'fem', 'x', 'dual', '1st', '2nd', '3rd'];
                    
                    // mapData is now List of Packed Strings: "GroupKey|Main~Count" or "Main"
                    inflectionHtmlContent = mapData.map(packedStr => {
                        const parts = packedStr.split('|');
                        const hasLabel = groupKeys.includes(parts[0]);
                        const group = hasLabel ? parts[0] : '';
                        const items = hasLabel ? parts.slice(1) : parts;
                        
                        const itemsHtml = items.map(itemStr => {
                            const [main, count] = itemStr.split('~');
                            if (count) {
                                return `<span class="dpd-inflection-item"><span class="inflection-main">${main}</span> <span class="inflection-count">${count}</span></span>`;
                            }
                            return `<span class="dpd-inflection-item">${main}</span>`;
                        }).join('');

                        const labelHtml = group 
                            ? `<span class="group-label">${group}:</span>` 
                            : '';
                        const groupClass = group ? `group-${group.replace(' ', '-')}` : 'group-other';
                        return `<div class="inflection-group ${groupClass} ">${labelHtml}${itemsHtml}</div>`;
                    }).join('');
                }
            } catch (e) { } 
        }

        // Append Stem & Pattern Info
        let metaHtml = '';
        if (data.stem && data.pattern) {
            metaHtml = `<div class="stem-pattern-info">${data.stem} • ${data.pattern}</div>`;
        }

        // Line 0
        let line0 = metaHtml;
        if (isSimilar) {
            const matchedKeyHtml = `<div class="inflection-group group-key"><span class="dpd-matched-key">matched: <b>${data.lookup_key}</b></span></div>`;
            line0 += `<div class="dpd-inflection-info">${matchedKeyHtml}${inflectionHtmlContent}</div>`;
        } else {
            if (inflectionHtmlContent) {
                line0 += `<div class="dpd-inflection-info">${inflectionHtmlContent}</div>`;
            }
        }
        
        // Check content to expand (Any of the detail fields present)
        const detailFields = [
            grammar, rootFamily, rootInfo, rootInSandhi, base, derivative, 
            phonetic, compound, antonym, synonym, variant, commentary, notes, 
            cognate, link, nonIa, sanskrit, sanskritRoot, example1, example2
        ];
        const hasDetails = detailFields.some(f => f);
        
        const tag = hasDetails ? 'details' : 'div';
        const summaryTag = hasDetails ? 'summary' : 'div';
        const classes = `dpd-entry ${hasDetails ? 'has-details' : 'no-details'}`;
        const openAttr = (hasDetails && isOpen) ? 'open' : '';

        let html = `<${tag} class="${classes}" ${openAttr}>`;
        
        // Line 1
        let line1 = `
            <div class="dpd-summary-line-1">
                <span class="dpd-lemma">${headword}</span>
                <span class="dpd-pos-group">
                    <span class="dpd-pos">${pos}</span>
                    ${degree ? `<span class="dpd-degree">${degree}</span>` : ''}
                </span>
            </div>`;

        // Line 2
        let line2 = '';
        if (construction) {
            const constrLines = construction.split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => {
                    // Granularly wrap Pāli words to allow individual lookups
                    // and wrap operators for styling
                    // regex includes common diacritics: ā ī ū ṅ ñ ṭ ḍ ṇ ḷ ṃ ṁ
                    return line.replace(/[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑṬḌṆḶṂṀ]+|\+/g, (match) => {
                        if (match === '+') {
                            return `<span class="dpd-operator">+</span>`;
                        }
                        return `<span class="dpd-construction-item clickable" data-lookup="${match}">${match}</span>`;
                    });
                })
                .join('<br>');
            line2 = `<div class="dpd-summary-line-2"><span class="dpd-construction">${constrLines}</span></div>`;
        }

        // Line 3
        // [MODIFIED] Format meaning to break only at semicolons
        const formattedMeaning = meaning.split(';')
            .map((segment, index, array) => {
                const text = segment.trim();
                // Add semicolon back if it's not the last segment
                const suffix = index < array.length - 1 ? ';' : '';
                return `<span class="dpd-meaning-segment">${text}${suffix}</span>`;
            })
            .join(' ');

        let line3 = `
            <div class="dpd-summary-line-3">
                ${plusCase ? `<span class="dpd-plus-case">(${plusCase})</span>` : ''}
                <span class="dpd-meaning">${formattedMeaning}</span>
                ${meaningLit ? `<div class="dpd-meaning-lit">lit. ${meaningLit}</div>` : ''}
            </div>`;
        
        html += `<${summaryTag} class="dpd-summary">
                    <div class="dpd-summary-content">
                        ${line0}
                        ${line1}
                        ${line2}
                        ${line3}
                    </div>
                    ${hasDetails ? '<span class="dpd-detail-icon"></span>' : ''}
                 </${summaryTag}>`;
        
        // Expanded Content
        if (hasDetails) {
            html += `<div class="dpd-details-content">`;
            html += `<table class="dpd-grammar-table">`;

            // Helper to render row
            const renderRow = (label, value) => {
                if (value) html += `<tr><th>${label}</th><td>${value}</td></tr>`;
            }

            renderRow("Grammar", grammar);
            renderRow("Root Family", rootFamily);
            renderRow("Root Info", rootInfo);
            renderRow("√ In Sandhi", rootInSandhi);
            renderRow("Base", base);
            renderRow("Derivative", derivative);
            renderRow("Phonetic", phonetic);
            renderRow("Compound", compound);
            renderRow("Antonym", antonym);
            renderRow("Synonym", synonym);
            renderRow("Variant", variant);
            renderRow("Commentary", commentary);
            renderRow("Notes", notes);
            renderRow("Cognate", cognate);
            renderRow("Link", link ? `<a href="${link}" target="_blank">${link}</a>` : null);
            renderRow("Non IA", nonIa);
            renderRow("Sanskrit", sanskrit);
            renderRow("Sanskrit Root", sanskritRoot);

            html += `</table>`;
            
            // Examples
            if (example1 || example2) {
                html += `<div class="dpd-examples"><p class="example-heading">Examples</p>`;
                
                const renderExample = (exStr) => {
                    if (!exStr) return;
                    const parts = exStr.split('|');
                    // Format: source|sutta|text
                    const source = parts[0] || '';
                    const sutta = parts[1] || '';
                    // Text might contain pipes? Unlikely given HTML content, but let's join rest
                    const text = parts.slice(2).join('|'); 
                    
                    html += `
                    <div class="example-box">
                        <p class="example-text">${text}</p>
                        <p class="example-source">${source} ${sutta}</p>
                    </div>`;
                };

                renderExample(example1);
                renderExample(example2);
                
                html += `</div>`;
            }
            
            html += `</div>`;
        }
        
        html += `</${tag}>`;
        return html;
    }
};
