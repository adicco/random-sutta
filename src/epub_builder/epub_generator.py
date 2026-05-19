# Path: src/epub_builder/epub_generator.py
import logging
import uuid
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .db_reader import DbReader
from .core.html_builder import HtmlBuilder
from .core.structure_processor import StructureProcessor
from .core.epub_packager import EpubPackager

logger = logging.getLogger("EpubBuilder.Generator")

class EpubGenerator:
    """
    Main orchestrator for EPUB generation.
    Coordinates database reading, tree traversal, HTML building, and packaging.
    """
    def __init__(self, output_path: Path, db_dir: Path, eng_only: bool = False, random_only: bool = False):
        self.output_path = output_path
        self.db_dir = db_dir
        self.eng_only = eng_only
        self.random_only = random_only
        self.epub_uuid = str(uuid.uuid4())
        self.date_str = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Build state
        self.pages: List[Dict[str, Any]] = []
        self.toc_entries: List[Dict[str, Any]] = []
        self.uid_to_filename: Dict[str, str] = {}
        self.spine_items: List[str] = []
        self.manifest_items: List[str] = []
        self.visited_uids = set()
        self.play_order = 1
        
        # Components
        self.db: Optional[DbReader] = None
        self.all_meta: Dict[str, Dict[str, Any]] = {}
        self.html_builder: Optional[HtmlBuilder] = None

    def build(self):
        """Execute the full EPUB building workflow."""
        logger.info("📚 Starting EPUB build process...")
        
        with DbReader(self.db_dir) as db:
            self.db = db
            self.all_meta = db.get_all_metadata()
            
            # 1. Pre-process Metadata & Structure
            StructureProcessor.correct_types(self.all_meta, self.db)
            self._initialize_mappings()
            
            tpk_tree = db.get_structure("tpk")
            if not tpk_tree:
                logger.error("❌ TPK tree not found in structure table.")
                return

            tpk_tree = StructureProcessor.flatten_single_chains(tpk_tree, self.all_meta)

            # 2. Generate Content
            self.html_builder = HtmlBuilder(
                self.db, 
                self.all_meta, 
                self.uid_to_filename, 
                eng_only=self.eng_only,
                pali_only_filter=True # Custom directive to filter for Pali
            )
            logger.info("🌳 Processing TPK tree...")
            self._traverse_tree(tpk_tree, self.toc_entries)

            # 3. Package EPUB
            packager = EpubPackager(self.output_path, self.epub_uuid, self.date_str, eng_only=self.eng_only)
            packager.package(
                pages=self.pages,
                toc_entries=self.toc_entries,
                manifest_items=self.manifest_items,
                spine_items=self.spine_items
            )

    def _initialize_mappings(self):
        """Pre-populate UID to filename mappings for consistent internal linking."""
        for m_uid, m_data in self.all_meta.items():
            if m_data.get("type") in ["leaf", "branch"]:
                safe_uid = m_uid.replace("/", "_").replace(":", "_")
                self.uid_to_filename[m_uid] = f"{safe_uid}.html"

    def _traverse_tree(self, node: Any, parent_toc_list: List[Dict[str, Any]], depth: int = 1):
        """Recursively traverse the book structure tree."""
        if isinstance(node, dict):
            for uid, children in node.items():
                # [FILTER] for random_only
                if self.random_only:
                    # 1. Skip Abhidhamma entirely
                    if uid == "abhidhamma":
                        continue
                    
                    # 2. Whitelists for navigation and inclusion
                    allowed_parents = {
                        'tpk', 'sutta', 'vinaya', 
                        'long', 'middle', 'linked', 'numbered', 'minor', 'kn'
                    }
                    allowed_sutta_books = {
                        'dn', 'mn', 'sn', 'an', 
                        'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig'
                    }
                    
                    is_allowed_parent = uid in allowed_parents
                    is_allowed_sutta = uid in allowed_sutta_books
                    is_vinaya = uid.startswith('pli-tv-')
                    
                    # Keep if it's a structural parent, a whitelisted sutta book, or any vinaya book
                    if not (is_allowed_parent or is_allowed_sutta or is_vinaya):
                        continue
                
                self._process_node(uid, children, parent_toc_list, depth)
        elif isinstance(node, list):
            for item in node:
                if isinstance(item, str):
                    self._process_node(item, None, parent_toc_list, depth)
                else:
                    self._traverse_tree(item, parent_toc_list, depth)

    def _process_node(self, uid: str, children: Any, parent_toc_list: List[Dict[str, Any]], depth: int):
        """Process a single node in the tree: generate page, update TOC, and handle children."""
        if uid in self.visited_uids:
            return
        self.visited_uids.add(uid)

        meta = self.all_meta.get(uid, {})
        m_type = meta.get("type", "branch")

        # Skip Alias types as they are not suitable for the EPUB structure
        if m_type == "alias":
            return

        # Handle Subleaf: point to parent leaf with anchor
        if m_type == "subleaf":
            parent_uid = meta.get("parent_uid")
            if not parent_uid:
                logger.warning(f"Subleaf {uid} missing parent_uid")
                return
            
            parent_filename = self.uid_to_filename.get(parent_uid)
            if not parent_filename:
                # Parent might not be in the current tree traversal or meta_map
                logger.warning(f"Parent leaf {parent_uid} for subleaf {uid} not found in mappings")
                return

            anchor = meta.get("extract_id") or uid
            filename = f"{parent_filename}#{anchor}"
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
            
            if children:
                self._traverse_tree(children, toc_entry["children"], depth + 1)
            return

        # Lazy-load children if not provided (e.g. for sub-books)
        if not children:
            book_structure = self.db.get_structure(uid)
            if book_structure:
                if isinstance(book_structure, dict) and uid in book_structure:
                    children = book_structure[uid]
                elif isinstance(book_structure, list):
                    children = book_structure
                
                # Flatten lazy-loaded structure to stay consistent with top-level tree
                if children:
                    children = StructureProcessor.flatten_single_chains(children, self.all_meta)

        # Generate HTML page
        page_result = self.html_builder.generate_page(uid, self.pages)
        if not page_result:
            # If skipping this node (e.g. alias/subleaf), still process its children
            if children:
                self._traverse_tree(children, parent_toc_list, depth)
            return

        filename, collected_headers = page_result
        meta = self.all_meta.get(uid, {})
        title = self.html_builder.get_title(uid, meta)
        
        # Create TOC entry
        toc_entry = {
            "uid": uid,
            "title": title,
            "filename": filename,
            "play_order": self.play_order,
            "children": []
        }
        self.play_order += 1
        parent_toc_list.append(toc_entry)
        
        # Update manifest and spine
        safe_uid = uid.replace("/", "_").replace(":", "_")
        self.spine_items.append(f'<itemref idref="item_{safe_uid}"/>')
        self.manifest_items.append(f'<item id="item_{safe_uid}" href="Text/{filename}" media-type="application/xhtml+xml"/>')

        # Add sub-headers found within the page to the TOC
        self._add_page_headers_to_toc(toc_entry, filename, uid, collected_headers)

        # Process children and update branch links
        child_uids = []
        if children:
            self._traverse_tree(children, toc_entry["children"], depth + 1)
            child_uids = self._extract_child_uids(children)

        # Post-process branch pages: replace placeholder with actual child links
        if meta.get("type", "branch") in ["branch", "root", "group"]:
            self._update_branch_links(uid, child_uids)

    def _add_page_headers_to_toc(self, parent_entry: Dict[str, Any], filename: str, base_uid: str, headers: List[Dict[str, Any]]):
        """Nest internal page headers into the hierarchical TOC."""
        header_stack = [(parent_entry, 0)]
        for header in headers:
            h_level = header.get("level", 1)
            new_entry = {
                "uid": f"{base_uid}_{header['anchor']}",
                "title": header["title"],
                "filename": f"{filename}#{header['anchor']}",
                "play_order": self.play_order,
                "children": []
            }
            self.play_order += 1
            
            while len(header_stack) > 1 and header_stack[-1][1] >= h_level:
                header_stack.pop()
                
            header_stack[-1][0]["children"].append(new_entry)
            header_stack.append((new_entry, h_level))

    def _extract_child_uids(self, children: Any) -> List[str]:
        """Normalize children nodes to a list of UIDs."""
        uids = []
        if isinstance(children, list):
            for c in children:
                if isinstance(c, str): uids.append(c)
                elif isinstance(c, dict): uids.extend(list(c.keys()))
        elif isinstance(children, dict):
            uids.extend(list(children.keys()))
        return uids

    def _update_branch_links(self, uid: str, child_uids: List[str]):
        """Replace {children_links} placeholder in branch pages with actual HTML links."""
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
            
        for page in self.pages:
            if page.get("uid") == uid and page.get("is_branch"):
                page["content"] = page["content"].replace("{children_links}", links_html)
                break
