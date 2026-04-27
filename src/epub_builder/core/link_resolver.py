# Path: src/epub_builder/core/link_resolver.py
import re
from typing import Dict, Any

def resolve_internal_links(html_text: str, uid_to_filename: Dict[str, str], all_meta: Dict[str, Dict[str, Any]]) -> str:
    """
    Finds links like <a href="index.html?q=dn6#1.1"> and resolves them to internal epub links like href="leaf_dn6.html#dn6:1.1".
    """
    if not html_text or "index.html?q=" not in html_text:
        return html_text
        
    pattern = r'''href=["']index\.html\?q=([^#"']+)#?([^"']*)["']'''
    
    def repl(match):
        uid = match.group(1)
        anchor = match.group(2)
        
        target_file = uid_to_filename.get(uid)
        
        # If the direct uid is not in uid_to_filename (e.g. it's a subleaf like an1.1, while file is an1.1-10)
        if not target_file:
            meta = all_meta.get(uid)
            if meta:
                m_type = meta.get("type")
                if m_type == "alias":
                    target_uid = meta.get("target_uid")
                    if target_uid:
                        target_file = uid_to_filename.get(target_uid)
                        uid = target_uid # Update uid for anchor construction
                elif m_type == "subleaf":
                    parent_uid = meta.get("parent_uid")
                    if parent_uid:
                        target_file = uid_to_filename.get(parent_uid)
                        
        if target_file:
            link = target_file
            if anchor:
                if not anchor.startswith(uid + ":"):
                    link += f"#{uid}:{anchor}"
                else:
                    link += f"#{anchor}"
            else:
                # If pointing to a subleaf without anchor, just use the subleaf uid as anchor
                meta = all_meta.get(uid)
                if meta and meta.get("type") == "subleaf":
                    link += f"#{uid}"
                    
            return f'href="{link}"'
            
        # Fallback if unresolved
        return 'href="#"'
        
    return re.sub(pattern, repl, html_text)
