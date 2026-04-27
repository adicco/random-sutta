# Path: src/epub_builder/templates.py
from pathlib import Path

_TEMPLATES_DIR = Path(__file__).parent / "templates"

def _read_template(filename: str) -> str:
    path = _TEMPLATES_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""

EPUB_MIMETYPE = "application/epub+zip"
CONTAINER_XML = _read_template("container.xml")
CONTENT_OPF_TEMPLATE = _read_template("content.opf.xml")
TOC_NCX_TEMPLATE = _read_template("toc.ncx.xml")
NAV_XHTML_TEMPLATE = _read_template("nav.xhtml")
PAGE_HTML_TEMPLATE = _read_template("page.html")
BRANCH_HTML_TEMPLATE = _read_template("branch.html")
STYLE_CSS = _read_template("style.css")