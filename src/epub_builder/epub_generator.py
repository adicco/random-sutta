# Path: src/epub_builder/epub_generator.py
import zipfile
import logging
import uuid
import datetime
from pathlib import Path
from typing import Dict, Any, List

from .db_reader import DbReader
from .templates import (
    EPUB_MIMETYPE, CONTAINER_XML, CONTENT_OPF_TEMPLATE, STYLE_CSS
)
from .core.html_builder import HtmlBuilder
from .core.toc_builder import TocBuilder

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
        
        self.html_builder = None

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

        page_result = self.html_builder.generate_page(uid, self.pages)
        if not page_result:
            # If it's an alias or failed or subleaf, still process children if any
            if children:
                self._traverse_tree(children, parent_toc_list, depth)
            return

        filename, collected_headers = page_result

        meta = self.all_meta.get(uid, {})
        title = self.html_builder.get_title(uid, meta)
        
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

        # Add headers found in this leaf to the TOC
        for header in collected_headers:
            toc_entry["children"].append({
                "uid": f"{uid}_{header['anchor']}",
                "title": header["title"],
                "filename": f"{filename}#{header['anchor']}",
                "play_order": self.play_order,
                "children": []
            })
            self.play_order += 1

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
                ctitle = self.html_builder.get_title(cid, cmeta)
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

    def build(self):
        logger.info("📚 Starting EPUB build process...")
        with DbReader(self.db_dir) as db:
            self.db = db
            self.all_meta = db.get_all_metadata()
            self.html_builder = HtmlBuilder(self.db, self.all_meta, self.uid_to_filename)
            
            # Map existing files so link_resolver can find them even if processed out of order?
            # Actually, to make link_resolver robust, we might pre-compute uid_to_filename for everything.
            # But the structure traversal creates filenames sequentially. For aliases, it resolves on-the-fly.
            # To be 100% safe, we should pre-populate uid_to_filename for all items, but for now we follow the traversal order.
            # Let's pre-populate uid_to_filename for all items based on their type to avoid unresolvable internal links.
            for m_uid, m_data in self.all_meta.items():
                if m_data.get("type") in ["leaf", "branch"]:
                    safe_uid = m_uid.replace("/", "_").replace(":", "_")
                    self.uid_to_filename[m_uid] = f"{m_data.get('type')}_{safe_uid}.html"

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
            ncx_content = TocBuilder.build_toc_ncx(self.toc_entries, self.uuid)
            epub.writestr("OEBPS/toc.ncx", ncx_content, compress_type=zipfile.ZIP_DEFLATED)
            
            nav_content = TocBuilder.build_nav_xhtml(self.toc_entries)
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
