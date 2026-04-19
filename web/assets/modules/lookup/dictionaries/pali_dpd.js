// Path: web/assets/modules/lookup/dictionaries/pali_dpd.js
import { SqliteConnection } from 'services/sqlite_connection.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("PaliDPD");

export const PaliDPD = {
    connection: null,
    _keyMap: { fullToAbbr: null, abbrToFull: null },

    /**
     * Init dictionary with dynamic config
     * @param {Object} config - { name: "db_name.db", path: "path/to/db.zip" }
     */
    async init(config) {
        if (!config || !config.path) {
            logger.error("Init", "Missing configuration");
            return false;
        }

        // Lazy initialization of connection
        if (!this.connection) {
            this.connection = new SqliteConnection(config.name, config.path);
        }

        const success = await this.connection.init();
        if (success) {
            await this._loadJsonKeys();
        }
        return success;
    },

    async search(term) {
        if (!this.connection) return [];
        if (!term) return [];
        const cleanTerm = term.toLowerCase().trim().normalize('NFC');
        
        try {
            // Optimized Lookup System: Using Specialized View (Exact Match + Decon Union)
            // Strategy: Union Keys First -> Join Data Later (Performance: < 1ms)
            
            // 1. Update Lookup Parameters
            await this.connection.run(
                "UPDATE _lookup_params SET term = :term", 
                { ':term': cleanTerm }
            );

            // 2. Fetch Results
            const results = await this.connection.run("SELECT * FROM view_lookup_results");

            if (!results.length) return [];

            const finalResults = [];
            const seenTargets = new Set();
            
            for (const row of results) {
                const uniqueId = `${row.type}_${row.target_id}`;
                if (seenTargets.has(uniqueId)) continue;
                seenTargets.add(uniqueId);
                
                // Logic Definition / Meaning
                // Type -1: Deconstruction (Components in 'meaning' col)
                // Type -2: Grammar Note (Pack in 'meaning' col)
                // Type 1: Entry (Meaning in 'meaning' col)
                // Type 0: Root (Meaning in 'meaning' col)
                
                // Polymorphic Fields Handling
                let rootInfo = null;
                let sanskrit = null;
                
                if (row.type === 1) { // Entry
                    rootInfo = row.entry_root_info;
                    sanskrit = row.entry_sanskrit;
                } else if (row.type === 0) { // Root
                    rootInfo = row.root_basic_info;
                    sanskrit = row.root_sanskrit_info;
                }

                finalResults.push({
                    lookup_key: row.key,
                    target_id: row.target_id,
                    lookup_type: row.type,
                    headword: row.headword,
                    headword_clean: row.headword_clean,
                    
                    // Identity & Meaning
                    pos: row.pos,
                    meaning: row.meaning,
                    meaning_lit: row.meaning_origin,
                    
                    // Morphology (Entry)
                    construction: row.construction,
                    degree: row.degree,
                    plus_case: row.plus_case,
                    stem: row.stem,
                    pattern: row.pattern,
                    grammar: row.grammar,
                    
                    // Root / Family
                    root_family: row.root_family,
                    root_info: rootInfo,
                    root_in_sandhi: row.root_in_sandhi,
                    
                    // Detail Morphology
                    base: row.base,
                    derivative: row.derivative,
                    phonetic: row.phonetic,
                    compound: row.compound,
                    
                    // Relations
                    antonym: row.antonym,
                    synonym: row.synonym,
                    variant: row.variant,
                    
                    // Notes / Meta
                    commentary: row.commentary,
                    notes: row.notes,
                    cognate: row.cognate,
                    link: row.link,
                    non_ia: row.non_ia,
                    
                    // Sanskrit
                    sanskrit: sanskrit,
                    sanskrit_root: row.entry_sanskrit_root, // Only for entries
                    
                    // Examples
                    example_1: row.example_1,
                    example_2: row.example_2,
                    
                    // Inflection Map (Grammatical Context)
                    inflection_map: row.inflection_map,
                    
                    keyMap: this._keyMap,
                    is_deconstruction: (row.type === -1),
                    is_exact: row.is_exact,
                    has_word: row.has_word
                });
            }
            return finalResults;
        } catch (error) {
            // [SELF-HEALING] Detect Schema Mismatch (Old DB vs New Code)
            if (error.message && error.message.includes("no such table")) {
                logger.error("Search Error", "Schema Mismatch detected! Resetting DB...");
                await this.connection.resetDatabase();
                window.location.reload();
                return [];
            }
            
            logger.error("Search Error", error);
            return [];
        }
    },

    async _loadJsonKeys() {
        try {
            const res = await this.connection.run("SELECT abbr_key, full_key FROM json_keys");
            if (res.length > 0) {
                this._keyMap.fullToAbbr = {};
                this._keyMap.abbrToFull = {};
                res.forEach(row => {
                    this._keyMap.fullToAbbr[row.full_key] = row.abbr_key;
                    this._keyMap.abbrToFull[row.abbr_key] = row.full_key;
                });
            }
        } catch (e) {
            logger.warn("Keys Load Error", e);
        }
    }
};
