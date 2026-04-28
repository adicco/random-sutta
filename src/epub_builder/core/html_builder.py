# Path: src/epub_builder/core/html_builder.py
import logging
import re
from typing import Dict, Any, List, Tuple, Optional
from ..templates import PAGE_HTML_TEMPLATE, BRANCH_HTML_TEMPLATE
from .link_resolver import resolve_internal_links

logger = logging.getLogger("EpubBuilder.HtmlBuilder")

class HtmlBuilder:
    def __init__(self, db, all_meta, uid_to_filename):
        self.db = db
        self.all_meta = all_meta
        self.uid_to_filename = uid_to_filename

    def get_title(self, uid: str, meta: Dict[str, Any]) -> str:
        translated = meta.get("translated_title")
        original = meta.get("original_title")
        acronym = meta.get("acronym")
        
        base_title = ""
        if translated and original:
            base_title = f"{translated} - {original}"
        else:
            base_title = translated or original or uid.upper()
            
        if acronym:
            return f"{acronym} - {base_title}"
        return base_title

    def build_segment_html(self, segment: Dict[str, Any], footnote_idx: int = 0, acronym: str = "") -> str:
        html_tag = segment.get("html", "")
        pli = segment.get("pli") or ""
        eng = segment.get("eng") or ""
        segment_id = segment.get("segment_id", "")
        
        if not pli and not eng:
            return ""

        content = ""
        if pli:
            pli_text = pli
            if not eng and footnote_idx > 0:
                pli_text += f' <sup class="footnote-ref"><a class="footnote-link" epub:type="noteref" href="#fn_{segment_id}" id="ref_{segment_id}">{footnote_idx}</a></sup>'
            content += f'<p class="pli">{pli_text}</p>'
            
        if eng:
            eng_text = eng
            if footnote_idx > 0:
                eng_text += f' <sup class="footnote-ref"><a class="footnote-link" epub:type="noteref" href="#fn_{segment_id}" id="ref_{segment_id}">{footnote_idx}</a></sup>'
            content += f'<p class="eng">{eng_text}</p>'
            
        inner_html = f'<div class="segment" id="{segment_id}">\n{content}\n</div>'
        
        if html_tag:
            # Replace UL block (usually containing division info) with the acronym
            if "<header>" in html_tag and "ul" in html_tag:
                acronym_html = f'<div class="low-profile-acronym">{acronym}</div>' if acronym else ""
                # More robust regex to catch <ul class="..."> and multi-line ULs
                new_tag, count = re.subn(r'<ul.*?>.*?</ul>', acronym_html, html_tag, flags=re.DOTALL)
                if count > 0:
                    html_tag = new_tag
                    # If we replaced the part containing {}, we need to make sure we don't lose the segment content if it's NOT just division info.
                    # But usually :0.1 is exactly for division. 
                    # If html_tag no longer has {}, we just return the acronym block.
                    if "{}" not in html_tag:
                        return html_tag
            
            if "{}" in html_tag:
                return html_tag.format(inner_html)
                
        return inner_html

    def generate_page(self, uid: str, pages_list: List[Dict[str, Any]]) -> Optional[Tuple[str, List[Dict[str, str]]]]:
        meta = self.all_meta.get(uid)
        if not meta:
            logger.warning(f"Missing metadata for {uid}")
            return None

        m_type = meta.get("type", "branch")
        if m_type == "subleaf":
            return None
            
        title = self.get_title(uid, meta)
        safe_uid = uid.replace("/", "_").replace(":", "_")
        filename = f"{m_type}_{safe_uid}.html"
        self.uid_to_filename[uid] = filename
        
        collected_headers = []
        
        if m_type == "leaf":
            segments = self.db.get_segments(uid, meta.get("book_id", ""))
            html_parts = []
            current_footnotes = []
            
            acronym = meta.get("acronym") or ""
                
            for seg in segments:
                html_tag = seg.get("html", "")
                comm = seg.get("comm")
                footnote_idx = 0
                if comm:
                    comm = resolve_internal_links(comm, self.uid_to_filename, self.all_meta)
                    current_footnotes.append((seg.get("segment_id", ""), comm))
                    footnote_idx = len(current_footnotes)
                
                if html_tag and any(tag in html_tag for tag in ["<h1", "<h2", "<h3", "<h4", "<h5", "<h6"]):
                    if "class='sutta-title'" not in html_tag and 'class="sutta-title"' not in html_tag:
                        header_text = seg.get("pli") or seg.get("eng") or "Section"
                        level = 1
                        if "<h2" in html_tag: level = 2
                        elif "<h3" in html_tag: level = 3
                        elif "<h4" in html_tag: level = 4
                        elif "<h5" in html_tag: level = 5
                        elif "<h6" in html_tag: level = 6
                        collected_headers.append({
                            "title": header_text,
                            "anchor": seg.get("segment_id", ""),
                            "level": level
                        })
                        
                html_parts.append(self.build_segment_html(seg, footnote_idx, acronym))
                
            if current_footnotes:
                fn_html = '<div class="footnotes-section">\n'
                for idx, (seg_id, comm_text) in enumerate(current_footnotes, 1):
                    fn_html += f'<div class="footnote-wrapper"><aside epub:type="footnote" id="fn_{seg_id}" class="footnote-item"><a class="footnote-back" href="#ref_{seg_id}">{idx}</a> {comm_text}</aside></div>\n'
                fn_html += '</div>'
                html_parts.append(fn_html)
                
            content_html = "\n".join(html_parts)
            if not content_html.strip():
                content_html = "<p><i>[No content available]</i></p>"
                
            page_html = PAGE_HTML_TEMPLATE.format(title=title, content=content_html)
            pages_list.append({"filename": filename, "content": page_html})
            
        elif m_type in ["branch", "root", "group"]:
            blurb = meta.get("blurb") or ""
            page_html = BRANCH_HTML_TEMPLATE.format(
                title=title, 
                blurb=blurb,
                children_links="{children_links}"
            )
            pages_list.append({"filename": filename, "content": page_html, "uid": uid, "is_branch": True})
            
        elif m_type == "alias":
            target = meta.get("target_uid")
            if target:
                self.uid_to_filename[uid] = self.uid_to_filename.get(target, f"leaf_{target.replace('/', '_')}.html")
            return None

        return filename, collected_headers
