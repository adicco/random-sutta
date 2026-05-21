# Path: src/dict_builder/logic/word_selector.py
from typing import List, Tuple, Set, Optional
from rich import print
from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy import select
from sqlalchemy.orm import Session
from rich import print

from src.dict_builder.db.models import DpdHeadword, Lookup
from src.dict_builder.logic.ebts_loader import load_cached_ebts_words
from src.dict_builder.tools.pali_sort_key import pali_sort_key
from src.dict_builder.tools.word_extractor import extract_words_from_string
from ..builder_config import BuilderConfig

class WordSelector:
    def __init__(self, config: BuilderConfig):
        self.config = config

    def get_target_ids(self, session: Session) -> Tuple[List[int], Optional[Set[str]]]:
        """
        Lấy danh sách ID cần xử lý và tập từ vựng đích (nếu có).
        IDs được sắp xếp theo Pali Alphabet của lemma_1.
        """
        print(f"[green]Scanning DPD DB (Mode: {self.config.mode})...")
        
        stmt = select(
            DpdHeadword.id, 
            DpdHeadword.lemma_1, 
            DpdHeadword.inflections, 
            DpdHeadword.inflections_api_ca_eva_iti
        )
        
        # FULL MODE: Không lọc, nhưng cần sắp xếp
        if self.config.is_full_mode:
            print("[green]Full Mode: Selecting and Sorting all IDs...")
            all_rows = session.execute(select(DpdHeadword.id, DpdHeadword.lemma_1)).all()
            all_rows.sort(key=lambda x: pali_sort_key(x[1]))
            sorted_ids = [row[0] for row in all_rows]
            return sorted_ids, None

        # MINI / TINY MODE
        bilara_path = self.config.PROJECT_ROOT / "data/sc-data/sc_bilara_data/root/pli/ms"

        if not bilara_path.exists():
            print(f"[red]Bilara data missing at {bilara_path}")
            return [], set()

        cache_dir = self.config.PROJECT_ROOT / "src/dict_builder/.cache"
        target_set = load_cached_ebts_words(bilara_path, self.config.EBTS_BOOKS, cache_dir)
        
        print(f"[green]Initial EBTS pool: {len(target_set)}")
        
        # --- RECURSIVE EXPANSION ---
        # 1. Build Maps (Word -> Components) to avoid repeated DB queries
        print("[yellow]Building Component Maps for Expansion...")
        
        # Map 1: Headword -> Construction & Commentary Components
        # Only fetch entries that HAVE construction OR commentary
        hw_query = select(DpdHeadword.lemma_1, DpdHeadword.construction, DpdHeadword.commentary).filter(
            (DpdHeadword.construction != "") | (DpdHeadword.commentary != "")
        )
        hw_rows = session.execute(hw_query).all()
        
        construction_map = {}
        for lemma, constr, comm in hw_rows:
            lemma_clean = lemma.split(" ", 1)[0]
            if lemma_clean not in construction_map:
                construction_map[lemma_clean] = set()
            
            # Extract from Construction
            if constr:
                construction_map[lemma_clean].update(extract_words_from_string(constr))
            
            # Extract from Commentary
            if comm:
                construction_map[lemma_clean].update(extract_words_from_string(comm))

        # Map 2: Deconstruction Key -> Deconstruction Components
        decon_query = select(Lookup.lookup_key, Lookup.deconstructor).filter(Lookup.deconstructor != "")
        decon_rows = session.execute(decon_query).all()
        
        decon_map = {}
        for key, decon_json in decon_rows:
            if key not in decon_map:
                decon_map[key] = set()
            # decon_json is string list json
            try:
                import json
                parts_list = json.loads(decon_json)
                for part in parts_list:
                    decon_map[key].update(extract_words_from_string(part))
            except:
                continue

        print(f"   Construction Map Size: {len(construction_map)}")
        print(f"   Deconstruction Map Size: {len(decon_map)}")

        # 2. Iterate until convergence
        print("[yellow]Expanding Target Set recursively...")
        
        # Ensure we don't loop forever
        MAX_ITERATIONS = 10 
        
        for i in range(MAX_ITERATIONS):
            new_words = set()
            
            # Check Headwords constructions
            # Tìm những từ trong target_set có construction components chưa có trong target_set
            # Optimization: Just check set difference
            
            # Words in target set that have constructions
            words_with_c = target_set.intersection(construction_map.keys())
            for w in words_with_c:
                components = construction_map[w]
                # Add components that are not yet in target_set
                # (Note: we add to new_words first to check convergence)
                diff = components - target_set
                new_words.update(diff)
                
            # Words in target set that have deconstructions
            words_with_d = target_set.intersection(decon_map.keys())
            for w in words_with_d:
                components = decon_map[w]
                diff = components - target_set
                new_words.update(diff)
            
            if not new_words:
                print(f"[green]   Converged at iteration {i}")
                break
                
            print(f"   Iteration {i}: Found {len(new_words)} new component words.")
            target_set.update(new_words)
            
        print(f"[green]Final Target words pool: {len(target_set)}")
        
        # --- FILTERING ---
        rows = session.execute(stmt).all()
        filtered_rows = []
        
        # [NEW] Pre-fetch Idioms IDs to ensure they are included
        print("[yellow]Fetching all Idioms & Sandhi (force include)...")
        # Fetch both 'idiom' and 'sandhi'
        special_ids_query = select(DpdHeadword.id).filter(DpdHeadword.pos.in_(['idiom', 'sandhi']))
        special_ids = {r[0] for r in session.execute(special_ids_query).all()}
        print(f"   Found {len(special_ids)} special entries (idiom/sandhi) in source DB.")

        for r in rows:
            r_id, lemma_1, inf1, inf2 = r
            
            # Force include if it is an idiom or sandhi
            if r_id in special_ids:
                filtered_rows.append(r)
                continue

            lemma_clean = lemma_1.split(" ", 1)[0]
            
            if lemma_clean in target_set:
                filtered_rows.append(r)
                continue
            
            if inf1 and any(word in target_set for word in inf1.split(",")):
                filtered_rows.append(r)
                continue
            
            if inf2 and any(word in target_set for word in inf2.split(",")):
                filtered_rows.append(r)
                continue
                
        print(f"[green]Filtered down to {len(filtered_rows)} / {len(rows)} entries.")
        
        print("[yellow]Sorting by Pali Alphabet...")
        filtered_rows.sort(key=lambda x: pali_sort_key(x[1]))
        
        target_ids = [r[0] for r in filtered_rows]
        return target_ids, target_set