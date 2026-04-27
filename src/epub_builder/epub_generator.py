# Path: src/epub_builder/epub_generator.py
import zipfile
import logging
import uuid
import datetime
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

from .db_reader import DbReader
from .templates import (
    EPUB_MIMETYPE, CONTAINER_XML, CONTENT_OPF_TEMPLATE,
    TOC_NCX_TEMPLATE, NAV_XHTML_TEMPLATE, PAGE_HTML_TEMPLATE,
    BRANCH_HTML_TEMPLATE, STYLE_CSS
)

logger = logging.getLogger("EpubBuilder.Generator")

class EpubGenerator:
    def __init__(self, output_path: Path, db_dir: Path):
        self.output_path = output_path
        self.db_dir = db_dir
        self.uuid = str(uuid.uuid4())
        self.date_str = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        self.pages: List[Dict[str, str]] = []  # List of pages to add
        self.toc_entries: List[Dict[str, Any]] = [] # For hierarchical TOC
        
        self.uid_to_filename: Dict[str, str] = {}
        self.db: DbReader = None
        self.all_meta: Dict[str, Dict[str, Any]] = {}
        
        self.play_order = 1
        self.spine_items = []
        self.manifest_items = []
        self.visited_uids = set()

    def _get_title(self, uid: str, meta: Dict[str, Any]) -> str:
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

    def _build_segment_html(self, segment: Dict[str, Any]) -> str:
        html_tag = segment.get("html", "")
        pli = segment.get("pli") or ""
        eng = segment.get("eng") or ""
        
        if not pli and not eng:
            return ""

        content = ""
        if pli:
            content += f'<p class="pli">{pli}</p>'
        if eng:
            content += f'<p class="eng">{eng}</p>'
            
        inner_html = f'<div class="segment" id="{segment.get("segment_id", "")}">\n{content}\n</div>'
        
        # If the html column has `{}` pattern (like `<h1>{}</h1>`)
        if html_tag and "{}" in html_tag:
            return html_tag.format(inner_html)
        return inner_html

    def _generate_page(self, uid: str) -> Optional[str]:
        meta = self.all_meta.get(uid)
        if not meta:
            logger.warning(f"Missing metadata for {uid}")
            return None

        m_type = meta.get("type", "branch")
        title = self._get_title(uid, meta)
        
        # Build filename based on type
        safe_uid = uid.replace("/", "_").replace(":", "_")
        filename = f"{m_type}_{safe_uid}.html"
        self.uid_to_filename[uid] = filename
        
        if m_type in ["leaf", "subleaf"]:
            # Fetch content
            segments = self.db.get_segments(uid, meta.get("book_id", ""))
            content_html = "\n".join([self._build_segment_html(seg) for seg in segments])
            if not content_html.strip():
                content_html = "<p><i>[No content available]</i></p>"
                
            page_html = PAGE_HTML_TEMPLATE.format(title=title, content=content_html)
            self.pages.append({"filename": filename, "content": page_html})
            
        elif m_type == "branch":
            blurb = meta.get("blurb") or ""
            # We will fill the children_links later when the tree is parsed
            # So for now, we just save the skeleton
            page_html = BRANCH_HTML_TEMPLATE.format(
                title=title, 
                blurb=blurb,
                children_links="{children_links}" # Placeholder
            )
            self.pages.append({"filename": filename, "content": page_html, "uid": uid, "is_branch": True})
            
        elif m_type == "alias":
            # Alias points to another uid. Let's just create a redirect or simple page if needed,
            # or map it to the target file.
            target = meta.get("target_uid")
            if target:
                self.uid_to_filename[uid] = self.uid_to_filename.get(target, f"leaf_{target.replace('/', '_')}.html")
            return None

        return filename

    def _traverse_tree(self, node: Any, parent_toc_list: List[Dict[str, Any]], depth: int = 1):
        if isinstance(node, dict):
            for uid, children in node.items():
                self._process_node(uid, children, parent_toc_list, depth)
        elif isinstance(node, list):
            for item in node:
                if isinstance(item, str):
                    self._process_node(item, None, parent_toc_list, depth)
                else:
                    self._traverse_tree(item, parent_toc_list, depth)

    def _process_node(self, uid: str, children: Any, parent_toc_list: List[Dict[str, Any]], depth: int):
        if uid in self.visited_uids:
            return
        self.visited_uids.add(uid)

        if not children:
            book_structure = self.db.get_structure(uid)
            if book_structure:
                if isinstance(book_structure, dict) and uid in book_structure:
                    children = book_structure[uid]
                elif isinstance(book_structure, list):
                    children = book_structure

        filename = self._generate_page(uid)
        if not filename:
            # If it's an alias or failed, still process children if any
            if children:
                self._traverse_tree(children, parent_toc_list, depth)
            return

        meta = self.all_meta.get(uid, {})
        title = self._get_title(uid, meta)
        
        toc_entry = {
            "uid": uid,
            "title": title,
            "filename": filename,
            "play_order": self.play_order,
            "children": []
        }
        self.play_order += 1
        parent_toc_list.append(toc_entry)
        
        self.spine_items.append(f'<itemref idref="item_{uid}"/>')
        self.manifest_items.append(f'<item id="item_{uid}" href="Text/{filename}" media-type="application/xhtml+xml"/>')

        child_uids = []
        if children:
            self._traverse_tree(children, toc_entry["children"], depth + 1)
            # Extract child uids for branch links
            if isinstance(children, list):
                for c in children:
                    if isinstance(c, str): child_uids.append(c)
                    elif isinstance(c, dict): child_uids.extend(list(c.keys()))
            elif isinstance(children, dict):
                child_uids.extend(list(children.keys()))

        # Update branch page content with links
        if meta.get("type", "branch") == "branch":
            links_html = ""
            for cid in child_uids:
                cmeta = self.all_meta.get(cid, {})
                ctitle = self._get_title(cid, cmeta)
                cfile = self.uid_to_filename.get(cid, "#")
                cblurb = cmeta.get("blurb", "")
                blurb_html = f'<div class="child-blurb">{cblurb}</div>' if cblurb else ""
                links_html += f'<li><a href="{cfile}">{ctitle}</a>{blurb_html}</li>\n'
            
            if not links_html:
                links_html = "<li><i>Empty</i></li>"
                
            # Find the page and update
            for page in self.pages:
                if page.get("uid") == uid and page.get("is_branch"):
                    page["content"] = page["content"].replace("{children_links}", links_html)
                    break

    def _build_toc_ncx(self) -> str:
        def build_nav_points(entries: List[Dict], level: int) -> str:
            res = ""
            for entry in entries:
                res += f'{"  " * level}<navPoint id="navPoint-{entry["play_order"]}" playOrder="{entry["play_order"]}">\n'
                res += f'{"  " * level}  <navLabel><text>{entry["title"]}</text></navLabel>\n'
                res += f'{"  " * level}  <content src="Text/{entry["filename"]}"/>\n'
                if entry["children"]:
                    res += build_nav_points(entry["children"], level + 2)
                res += f'{"  " * level}</navPoint>\n'
            return res
            
        nav_points = build_nav_points(self.toc_entries, 2)
        return TOC_NCX_TEMPLATE.format(
            uuid=self.uuid, depth=5, title="Random Sutta TPK", nav_points=nav_points
        )

    def _build_nav_xhtml(self) -> str:
        def build_nav_list(entries: List[Dict], level: int) -> str:
            if not entries: return ""
            res = f'{"  " * level}<ol>\n'
            for entry in entries:
                res += f'{"  " * (level + 1)}<li><a href="Text/{entry["filename"]}">{entry["title"]}</a>\n'
                if entry["children"]:
                    res += build_nav_list(entry["children"], level + 2)
                res += f'{"  " * (level + 1)}</li>\n'
            res += f'{"  " * level}</ol>\n'
            return res
            
        nav_list = build_nav_list(self.toc_entries, 2)
        return NAV_XHTML_TEMPLATE.format(title="Table of Contents", nav_list=nav_list)

    def build(self):
        logger.info("📚 Starting EPUB build process...")
        with DbReader(self.db_dir) as db:
            self.db = db
            self.all_meta = db.get_all_metadata()
            
            tpk_tree = db.get_structure("tpk")
            if not tpk_tree:
                logger.error("❌ TPK tree not found in structure table.")
                return

            logger.info("🌳 Processing TPK tree...")
            self._traverse_tree(tpk_tree, self.toc_entries)

        logger.info(f"📦 Zipping EPUB to {self.output_path}...")
        with zipfile.ZipFile(str(self.output_path), 'w') as epub:
            # mimetype must be uncompressed and first
            epub.writestr("mimetype", EPUB_MIMETYPE, compress_type=zipfile.ZIP_STORED)
            
            # Container
            epub.writestr("META-INF/container.xml", CONTAINER_XML, compress_type=zipfile.ZIP_DEFLATED)
            
            # Styles
            epub.writestr("OEBPS/Styles/style.css", STYLE_CSS, compress_type=zipfile.ZIP_DEFLATED)
            
            # Write all generated pages
            for page in self.pages:
                epub.writestr(f"OEBPS/Text/{page['filename']}", page["content"], compress_type=zipfile.ZIP_DEFLATED)
            
            # TOCs
            ncx_content = self._build_toc_ncx()
            epub.writestr("OEBPS/toc.ncx", ncx_content, compress_type=zipfile.ZIP_DEFLATED)
            
            nav_content = self._build_nav_xhtml()
            epub.writestr("OEBPS/nav.xhtml", nav_content, compress_type=zipfile.ZIP_DEFLATED)
            
            # OPF
            opf_content = CONTENT_OPF_TEMPLATE.format(
                title="Random Sutta TPK",
                author="Sutta Processor",
                language="en",
                uuid=self.uuid,
                date=self.date_str,
                manifest_items="\n".join(self.manifest_items),
                spine_items="\n".join(self.spine_items)
            )
            epub.writestr("OEBPS/content.opf", opf_content, compress_type=zipfile.ZIP_DEFLATED)

        logger.info(f"✅ Successfully created {self.output_path}")
