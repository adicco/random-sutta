# Path: src/epub_builder/templates.py

EPUB_MIMETYPE = "application/epub+zip"

CONTAINER_XML = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>
"""

CONTENT_OPF_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>{title}</dc:title>
    <dc:creator>{author}</dc:creator>
    <dc:language>{language}</dc:language>
    <dc:identifier id="BookId">urn:uuid:{uuid}</dc:identifier>
    <meta property="dcterms:modified">{date}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="Styles/style.css" media-type="text/css"/>
{manifest_items}
  </manifest>
  <spine toc="ncx">
{spine_items}
  </spine>
</package>
"""

TOC_NCX_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:{uuid}"/>
    <meta name="dtb:depth" content="{depth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>{title}</text>
  </docTitle>
  <navMap>
{nav_points}
  </navMap>
</ncx>
"""

NAV_XHTML_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="Styles/style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
{nav_list}
  </nav>
</body>
</html>
"""

PAGE_HTML_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
</head>
<body>
  <div class="sutta-container">
{content}
  </div>
</body>
</html>
"""

BRANCH_HTML_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="../Styles/style.css"/>
</head>
<body>
  <div class="branch-container">
    <h1>{title}</h1>
    <p class="blurb">{blurb}</p>
    <ul class="branch-list">
{children_links}
    </ul>
  </div>
</body>
</html>
"""

STYLE_CSS = """
/* Tối giản EPUB Style */
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 20px;
}

h1, h2, h3, h4, h5, h6 {
    color: #111;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
}

h1 { font-size: 1.8em; text-align: center; }
h2 { font-size: 1.5em; }

.sutta-container {
    max-width: 800px;
    margin: 0 auto;
}

.branch-container {
    text-align: center;
}

.blurb {
    font-style: italic;
    color: #555;
    margin-bottom: 2em;
}

.low-profile-acronym {
    text-align: center;
    font-size: 0.9em;
    color: #888;
    letter-spacing: 1px;
    margin-bottom: 1em;
    text-transform: uppercase;
}

.invisible-segment {
    display: none;
}

.branch-list {
    list-style-type: none;
    padding: 0;
    text-align: left;
    max-width: 600px;
    margin: 0 auto;
}

.branch-list li {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;
}

.branch-list a {
    text-decoration: none;
    color: #0056b3;
    font-weight: bold;
    display: block;
}

.branch-list .child-blurb {
    font-size: 0.9em;
    color: #666;
    margin-top: 4px;
}

/* Bilingual Segment Styling */
.segment {
    margin-bottom: 1.2em;
    padding-bottom: 0.5em;
}

.pli {
    font-style: italic;
    color: #000;
    margin: 0 0 0.4em 0;
}

.eng {
    margin: 0;
    color: #444;
}

/* Các trường hợp HTML có tag sẵn (vd <h1>{}</h1>) */
.segment h1, .segment h2, .segment h3 {
    text-align: center;
}

.segment h1 .pli, .segment h2 .pli, .segment h3 .pli {
    font-style: normal;
    font-weight: bold;
}

.segment blockquote {
    margin-left: 1.5em;
    border-left: 3px solid #ccc;
    padding-left: 1em;
    color: #555;
}
"""
