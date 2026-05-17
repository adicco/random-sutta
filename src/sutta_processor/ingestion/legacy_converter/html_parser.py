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

        # 1. Clean up latin text (we only want Chinese for root text)
        for latin_elem in article.find_all(class_='latin'):
            latin_elem.decompose()
            
        # Remove footer (contains English translation details)
        footer = article.find('footer')
        if footer:
            footer.decompose()

        # 2. Extract references & Segment Blocks
        block_tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li']
        
        header = article.find('header', class_='mirror')
        suttainfo = article.find('div', class_='suttainfo')
        
        header_blocks = header.find_all(block_tags) if header else []
        suttainfo_blocks = suttainfo.find_all(block_tags) if suttainfo else []
        
        all_blocks = article.find_all(block_tags)
        body_blocks = [b for b in all_blocks if b not in header_blocks and b not in suttainfo_blocks]

        root_dict = {}
        ref_dict = {}
        
        # Meta blocks (0.x)
        meta_sent_idx = 1
        for block in header_blocks + suttainfo_blocks:
            refs = self._extract_refs(block, taisho_no)
            text = block.get_text().strip()
            if not text:
                continue
            
            sid = f"{uid}:0.{meta_sent_idx}"
            root_dict[sid] = text # No sentence splitting for meta blocks
            if refs:
                ref_dict[sid] = ", ".join(refs)
                
            marker = soup.new_tag('bilara-seg', id=sid)
            marker.string = "{_}"
            block.clear()
            block.append(marker)
            meta_sent_idx += 1

        # Body blocks (1.x, 2.x ...)
        para_idx = 1
        for block in body_blocks:
            refs = self._extract_refs(block, taisho_no)
            text = block.get_text().strip()
            if not text:
                continue
                
            sentences = self.segmenter.segment_text(text)
            block.clear()
            
            for sent_idx, sentence in enumerate(sentences, 1):
                sid = f"{uid}:{para_idx}.{sent_idx}"
                root_dict[sid] = sentence
                if sent_idx == 1 and refs:
                    ref_dict[sid] = ", ".join(refs)
                    
                marker = soup.new_tag('bilara-seg', id=sid)
                marker.string = "{_}"
                block.append(marker)
            
            para_idx += 1

        # 3. Generate HTML Templates
        html_str = str(article)
        html_dict = {}
        
        pattern = r'(<bilara-seg id="([^"]+)">\{_\}</bilara-seg>)'
        parts = re.split(pattern, html_str)
        
        if len(parts) > 1:
            current_html = parts[0]
            
            for i in range(1, len(parts), 3):
                sid = parts[i+1]
                next_chunk = parts[i+2]
                
                tmpl = current_html + "{}"
                
                # if this is the last segment, append the remaining HTML
                if i + 3 >= len(parts):
                    tmpl += next_chunk
                else:
                    # To mimic SC more closely, if next_chunk is just closing tags then whitespace then opening tags,
                    # we could split it. But shifting is 100% safe. We will shift.
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
