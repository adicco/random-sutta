# Path: src/sutta_processor/ingestion/legacy_converter/html_parser.py
from bs4 import BeautifulSoup
import re
from typing import Dict, Any

from .segmenter import TextSegmenter

class LegacyHtmlParser:
    def __init__(self, taisho_mapping: Dict[str, str]):
        self.taisho_mapping = taisho_mapping
        self.segmenter = TextSegmenter()

    def parse(self, html_content: str, uid: str, taisho_no: str) -> Dict[str, Any]:
        soup = BeautifulSoup(html_content, 'html.parser')
        article = soup.find('article')
        if not article:
            raise ValueError(f"No <article> tag found in {uid}")

        # 1. CLEANUP PHASE
        # Remove latin text
        for latin_elem in article.find_all(class_='latin'):
            latin_elem.decompose()
            
        # Remove footer
        footer = article.find('footer')
        if footer:
            footer.decompose()

        # [NEW] GLOBAL REFERENCE EXTRACTION
        # Collect all refs and map them to their parent block's unique ID/position
        # To avoid visible refs in templates, we MUST remove them globally first.
        all_refs = article.find_all('a', class_='ref t')
        ref_mapping = {} # Store refs grouped by the block they were in
        for ref_tag in all_refs:
            ref_id = ref_tag.get('id')
            if ref_id:
                clean_id = re.sub(r'^t0*', '', ref_id)
                val = f"t{taisho_no}.{clean_id}"
                
                # Find nearest block parent (h1, p, etc.)
                parent_block = ref_tag.find_parent(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'])
                if parent_block:
                    # Tag the block temporarily so we know where to attach the ref later
                    if not parent_block.has_attr('data-ref-ptr'):
                        parent_block['data-ref-ptr'] = f"b-{id(parent_block)}"
                    ptr = parent_block['data-ref-ptr']
                    if ptr not in ref_mapping: ref_mapping[ptr] = []
                    ref_mapping[ptr].append(val)
            
            ref_tag.decompose() # Remove from DOM globally

        # 2. SEGMENTATION PHASE
        block_tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li']
        
        # Robust Metadata Detection (0.x)
        # ONLY <header> is considered strict metadata for 0.x
        meta_containers = article.select('header')
        
        meta_blocks = []
        for container in meta_containers:
            meta_blocks.extend(container.find_all(block_tags))
        
        # All other blocks including .suttainfo and .xu are treated as body content
        all_blocks = article.find_all(block_tags)
        body_blocks = [b for b in all_blocks if b not in meta_blocks]

        root_dict = {}
        ref_dict = {}
        
        # Helper to process blocks
        def process_blocks(blocks, is_meta, start_idx):
            idx = start_idx
            for block in blocks:
                ptr = block.get('data-ref-ptr')
                block_refs = ref_mapping.get(ptr, [])
                
                # Check if block is empty or contains only whitespace/BR
                if not block.get_text().strip() and not block.find('br'): 
                    continue
                
                # Handle <br> as hard breaks by splitting the block's content
                is_gatha = block.get('class') == ['gatha'] or (block.parent and block.parent.get('class') == ['gatha'])
                
                # Pre-process: replace <br> with a special marker to split easily
                for br in block.find_all('br'):
                    br.replace_with("||BR_MARKER||")
                
                full_text = block.get_text()
                text_parts = full_text.split("||BR_MARKER||")
                
                block.clear()
                
                for i, part in enumerate(text_parts):
                    clean_part = part.strip()
                    if clean_part:
                        # For gathas, we wrap each line in a row container for stable grid layout
                        row_container = soup.new_tag('span', **{'class': 'gatha-row'}) if is_gatha else block
                        
                        sub_sentences = self.segmenter.segment_text(clean_part)
                        for s_idx, sentence in enumerate(sub_sentences, 1):
                            sid = f"{uid}:{idx}.{s_idx}" if not is_meta else f"{uid}:0.{idx}"
                            root_dict[sid] = sentence
                            
                            if idx == start_idx and s_idx == 1 and block_refs:
                                ref_dict[sid] = ", ".join(block_refs)
                            
                            marker = soup.new_tag('bilara-seg', id=sid)
                            marker.string = "{_}"
                            
                            if is_gatha:
                                row_container.append(marker)
                            else:
                                block.append(marker)
                            
                            if is_meta: idx += 1 
                        
                        if is_gatha:
                            block.append(row_container)
                            
                        if not is_meta: idx += 1
                    
                    if i < len(text_parts) - 1:
                        block.append(soup.new_tag('br'))
            return idx

        process_blocks(meta_blocks, True, 1)
        process_blocks(body_blocks, False, 1)

        # 3. HTML TEMPLATE GENERATION
        # Clean up any leftover pointer attributes
        for b in article.find_all(attrs={"data-ref-ptr": True}):
            del b['data-ref-ptr']

        html_str = str(article)
        # Normalize newlines: remove excessive ones around tags
        html_str = re.sub(r'>\s*\n\s*<', '><', html_str)
        html_str = re.sub(r'\s*\n\s*', ' ', html_str) # Flatten to single line for predictable splitting

        html_dict = {}
        pattern = r'(<bilara-seg id="([^"]+)">\{_\}</bilara-seg>)'
        parts = re.split(pattern, html_str)
        
        if len(parts) > 1:
            current_html = parts[0].strip()
            for i in range(1, len(parts), 3):
                sid = parts[i+1]
                next_chunk = parts[i+2].strip()
                tmpl = current_html + "{}"
                if i + 3 >= len(parts):
                    tmpl += next_chunk
                else:
                    current_html = next_chunk
                html_dict[sid] = tmpl

        return {
            "root": root_dict,
            "html": html_dict,
            "reference": ref_dict
        }

    def _extract_refs(self, block, taisho_no: str) -> list:
        refs = []
        for ref_tag in block.find_all('a', class_='ref t'):
            ref_id = ref_tag.get('id')
            if ref_id:
                clean_id = re.sub(r'^t0*', '', ref_id)
                refs.append(f"t{taisho_no}.{clean_id}")
            ref_tag.decompose()
        return refs
