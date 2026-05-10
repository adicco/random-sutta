# Path: src/epub_builder/core/epub_packager.py
import zipfile
import logging
from pathlib import Path
from typing import Dict, Any, List
from ..templates import (
    EPUB_MIMETYPE, CONTAINER_XML, CONTENT_OPF_TEMPLATE, STYLE_CSS,
    COVER_HTML_TEMPLATE, COVER_IMAGE, COVER_ENG_IMAGE
)
from .toc_builder import TocBuilder

logger = logging.getLogger("EpubBuilder.Packager")

class EpubPackager:
    def __init__(self, output_path: Path, epub_uuid: str, date_str: str, eng_only: bool = False):
        self.output_path = output_path
        self.epub_uuid = epub_uuid
        self.date_str = date_str
        self.eng_only = eng_only

    def package(self, 
                pages: List[Dict[str, str]], 
                toc_entries: List[Dict[str, Any]], 
                manifest_items: List[str], 
                spine_items: List[str]):
        
        logger.info(f"📦 Zipping EPUB to {self.output_path}...")
        
        # Prepare Cover logic
        cover_meta = ""
        cover_manifest = ""
        cover_spine = ""
        
        processed_toc = list(toc_entries) # Copy to avoid side effects
        
        active_cover_image = COVER_ENG_IMAGE if self.eng_only and COVER_ENG_IMAGE else COVER_IMAGE

        if active_cover_image:
            cover_meta = '    <meta name="cover" content="cover-image"/>'
            cover_manifest = '    <item id="cover-image" href="Images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>\n'
            cover_manifest += '    <item id="cover" href="Text/cover.html" media-type="application/xhtml+xml"/>'
            cover_spine = '    <itemref idref="cover" linear="yes"/>'
            
            cover_toc_entry = {
                "uid": "cover",
                "title": "Cover",
                "filename": "cover.html",
                "play_order": 0,
                "children": []
            }
            processed_toc.insert(0, cover_toc_entry)

        with zipfile.ZipFile(str(self.output_path), 'w') as epub:
            # mimetype must be uncompressed and first
            epub.writestr("mimetype", EPUB_MIMETYPE, compress_type=zipfile.ZIP_STORED)
            
            # Container
            epub.writestr("META-INF/container.xml", CONTAINER_XML, compress_type=zipfile.ZIP_DEFLATED)
            
            # Styles
            epub.writestr("OEBPS/Styles/style.css", STYLE_CSS, compress_type=zipfile.ZIP_DEFLATED)
            
            # Write all generated pages
            for page in pages:
                epub.writestr(f"OEBPS/Text/{page['filename']}", page["content"], compress_type=zipfile.ZIP_DEFLATED)
            
            # Write Cover
            if active_cover_image:
                epub.writestr("OEBPS/Images/cover.jpg", active_cover_image, compress_type=zipfile.ZIP_STORED)
                epub.writestr("OEBPS/Text/cover.html", COVER_HTML_TEMPLATE, compress_type=zipfile.ZIP_DEFLATED)
            
            # TOCs
            ncx_title = "SuttaCentral Tipitaka [Eng]" if self.eng_only else "SuttaCentral Tipitaka"
            ncx_content = TocBuilder.build_toc_ncx(processed_toc, self.epub_uuid, title=ncx_title)
            epub.writestr("OEBPS/toc.ncx", ncx_content, compress_type=zipfile.ZIP_DEFLATED)
            
            nav_content = TocBuilder.build_nav_xhtml(processed_toc)
            epub.writestr("OEBPS/nav.xhtml", nav_content, compress_type=zipfile.ZIP_DEFLATED)
            
            # OPF
            opf_title = "SuttaCentral Tipitaka [Eng]" if self.eng_only else "SuttaCentral Tipitaka"
            opf_content = CONTENT_OPF_TEMPLATE.format(
                title=opf_title,
                author="Random Sutta",
                language="en",
                uuid=self.epub_uuid,
                date=self.date_str,
                cover_meta=cover_meta,
                cover_manifest=cover_manifest,
                cover_spine=cover_spine,
                manifest_items="\n".join(manifest_items),
                spine_items="\n".join(spine_items)
            )
            epub.writestr("OEBPS/content.opf", opf_content, compress_type=zipfile.ZIP_DEFLATED)

        logger.info(f"✅ Successfully created {self.output_path}")
