# Path: src/epub_builder/core/link_resolver.py
import re
from typing import Dict, Any

def resolve_internal_links(html_text: str, uid_to_filename: Dict[str, str], all_meta: Dict[str, Dict[str, Any]]) -> str:
    """
    Finds links like <a href="index.html?q=dn6#1.1"> and resolves them to external app links like href="https://vjjda.github.io/random-sutta/?q=dn6#1.1".
    """
    if not html_text or "index.html?q=" not in html_text:
        return html_text
        
    pattern = r'''href=["']index\.html\?q=([^#"']+)#?([^"']*)["']'''
    
    def repl(match):
        uid = match.group(1)
        anchor = match.group(2)
        
        # Resolve aliases if necessary
        meta = all_meta.get(uid)
        if meta:
            m_type = meta.get("type")
            if m_type == "alias":
                target_uid = meta.get("target_uid")
                if target_uid:
                    uid = target_uid
                    
        link = f"https://vjjda.github.io/random-sutta/?q={uid}"
        if anchor:
            link += f"#{anchor}"
                
        return f'href="{link}" target="_blank"'
        
    return re.sub(pattern, repl, html_text)
