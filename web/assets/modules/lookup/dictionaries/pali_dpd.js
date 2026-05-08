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
            // Optimized Lookup System: Single Atomic Parameterized Query
            // Strategy: Avoid mutating DB state to prevent race conditions during concurrent lookups.
            
            const sql = `
                WITH 
                    keys_decon AS (
                        SELECT 
                            word as key, 
                            0 as target_id, 
                            -1 as type,
                            0 as priority,
                            0 as rank
                        FROM deconstructions
                        WHERE word = $term
                        LIMIT 1
                    ),
                    keys_main AS (
                        SELECT 
                            key, target_id, type, 
                            1 as priority,
                            rank
                        FROM lookups_fts
                        WHERE lookups_fts MATCH $term
                    ),
                    all_keys AS (
                        SELECT * FROM keys_decon
                        UNION ALL
                        SELECT * FROM keys_main
                    )
                SELECT 
                    k.key, k.target_id, k.type,
                    CASE 
                        WHEN k.type = -1 THEN k.key 
                        WHEN k.type = 1 THEN e.headword
                        WHEN k.type = 0 THEN r.root
                        ELSE k.key
                    END AS headword,
                    CASE 
                        WHEN k.type = 1 THEN e.headword_clean
                        WHEN k.type = 0 THEN r.root_clean
                        ELSE NULL
                    END AS headword_clean,
                    CASE WHEN k.type = 1 THEN e.pos WHEN k.type = 0 THEN 'root' ELSE NULL END AS pos,
                    CASE 
                        WHEN k.type = 1 THEN e.meaning 
                        WHEN k.type = 0 THEN r.root_meaning 
                        WHEN k.type = -1 THEN d.components
                        ELSE NULL 
                    END AS meaning,
                    CASE 
                        WHEN k.type = 1 THEN e.meaning_lit 
                        WHEN k.type = 0 THEN r.sanskrit_root_meaning 
                        ELSE NULL 
                    END AS meaning_origin,
                    
                    -- Entry Specifics
                    e.grammar,
                    e.construction,
                    e.degree,
                    e.plus_case,
                    e.stem,
                    e.pattern,
                    e.root_family,
                    e.root_info AS entry_root_info,
                    e.root_in_sandhi,
                    e.base,
                    e.derivative,
                    e.phonetic,
                    e.compound,
                    e.antonym,
                    e.synonym,
                    e.variant,
                    e.commentary,
                    e.notes,
                    e.cognate,
                    e.link,
                    e.non_ia,
                    e.sanskrit AS entry_sanskrit,
                    e.sanskrit_root AS entry_sanskrit_root,
                    e.example_1,
                    e.example_2,
                    
                    -- Root Specifics
                    (r.root_group || ' ' || r.root_sign) AS root_basic_info, 
                    CASE 
                        WHEN r.sanskrit_root IS NOT NULL AND r.sanskrit_root != '' 
                        THEN r.sanskrit_root || ' ' || r.sanskrit_root_class
                        ELSE ''
                    END AS root_sanskrit_info,
                    
                    -- Meta
                    k.priority,
                    (k.key = $term) AS is_exact,
                    (
                        k.key = $term OR
                        k.key LIKE $term || ' %' OR
                        k.key LIKE '% ' || $term OR
                        k.key LIKE '% ' || $term || ' %'
                    ) AS has_word,
                    l.inflection_map
                FROM all_keys k
                LEFT JOIN entries e ON k.target_id = e.id AND k.type = 1
                LEFT JOIN roots r ON k.target_id = r.id AND k.type = 0
                LEFT JOIN deconstructions d ON k.key = d.word AND k.type = -1
                LEFT JOIN lookups l ON k.key = l.key AND k.target_id = l.target_id AND k.type = l.type
                ORDER BY 
                    k.priority ASC, 
                    is_exact DESC,
                    has_word DESC,
                    k.rank ASC;
            `;

            // 2. Fetch Results (Pass parameter via object for named binding)
            const results = await this.connection.run(sql, { $term: cleanTerm });

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
        if (this._keyMap && this._keyMap.fullToAbbr) return;
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
    },

    async close() {
        if (this.connection) {
            await this.connection.close();
            this._keyMap.fullToAbbr = null;
            this._keyMap.abbrToFull = null;
        }
    }
};
