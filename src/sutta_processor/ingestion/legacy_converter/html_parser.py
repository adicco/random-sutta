# Path: src/sutta_processor/ingestion/legacy_converter/html_parser.py
from bs4 import BeautifulSoup, Tag, NavigableString
from typing import List, Dict, Tuple, Any
import re

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

        # 2. Extract Taisho references mapping
        # Taisho refs are like <a class='ref t' id='t0421a14'>
        # We want to associate them with the nearest block.
        # Instead of nearest block, we can just collect them per text block.
        
        # We will walk the DOM and find text blocks: h1, h2, h3, p, li, (and div if it has direct text)
        block_tags = ['h1', 'h2', 'h3', 'p', 'li']
        blocks = article.find_all(block_tags)

        root_dict = {}
        html_dict = {}
        ref_dict = {}

        block_idx = 0
        
        # We need to preserve the wrapper tags like <article>, <header>, <div class="suttainfo">
        # A simple way to do this is to attach the un-handled outer HTML to the first and last blocks.
        
        # We will modify the DOM directly. For each block, we extract its text, decompose its children, 
        # and leave a placeholder tag. But it's easier to just build the dicts by iteration.
        
        for i, block in enumerate(blocks):
            # Check if this block is inside another block (e.g. p inside div is fine, but p inside p is bad)
            # Normally legacy HTML is flat enough.
            
            # Extract references inside this block
            refs = []
            for ref_tag in block.find_all('a', class_='ref t'):
                ref_id = ref_tag.get('id')
                if ref_id:
                    # e.g., t0421a14 -> t26.421a14
                    # Remove the leading 't0' or 't', keep the rest
                    clean_id = re.sub(r'^t0*', '', ref_id)
                    refs.append(f"t{taisho_no}.{clean_id}")
                ref_tag.decompose() # Remove from block so it doesn't appear in text
            
            # If block is empty after removing refs, skip it unless it's structural
            text = block.get_text().strip()
            if not text:
                continue
                
            block_idx += 1
            sentences = self.segmenter.segment_text(text)
            
            # Get opening and closing tags of the block
            block_content = block.decode_contents()
            block_str = str(block)
            
            # Safe split
            if block_content:
                parts = block_str.split(block_content, 1)
                opening_tag = parts[0]
                closing_tag = parts[1] if len(parts) > 1 else f"</{block.name}>"
            else:
                opening_tag = block_str
                closing_tag = ""

            # Handle the very first block: prepend <article><header...>
            if block_idx == 1:
                # We need to find all previous siblings of this block and their parents up to article
                # To simplify, we just hardcode the opening article tag
                # A more robust way is to just use the block's opening tag, and lose the outer divs, 
                # but Bilara needs valid HTML when assembled.
                pass # We'll refine HTML template assembly later if needed.
                
            for sent_idx, sentence in enumerate(sentences, 1):
                sid = f"{uid}:{block_idx}.{sent_idx}"
                root_dict[sid] = sentence
                
                # HTML Template logic
                if len(sentences) == 1:
                    tmpl = f"{opening_tag}{{}}{closing_tag}"
                elif sent_idx == 1:
                    tmpl = f"{opening_tag}{{}}"
                elif sent_idx == len(sentences):
                    tmpl = f"{{}}{closing_tag}"
                else:
                    tmpl = "{}"
                    
                html_dict[sid] = tmpl
                
                # Attach all refs of the block to its first sentence
                if sent_idx == 1 and refs:
                    ref_dict[sid] = ", ".join(refs)

        # For Bilara compatibility, the very first template should ideally contain <article id="uid">
        # We can just prepend it to the first key in html_dict
        if html_dict:
            first_key = list(html_dict.keys())[0]
            html_dict[first_key] = f"<article id='{uid}'>\n" + html_dict[first_key]
            
            last_key = list(html_dict.keys())[-1]
            html_dict[last_key] = html_dict[last_key] + "\n</article>"

        return {
            "root": root_dict,
            "html": html_dict,
            "reference": ref_dict
        }
