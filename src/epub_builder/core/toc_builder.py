# Path: src/epub_builder/core/toc_builder.py
from typing import Dict, Any, List
from ..templates import TOC_NCX_TEMPLATE, NAV_XHTML_TEMPLATE

class TocBuilder:
    @staticmethod
    def build_toc_ncx(toc_entries: List[Dict[str, Any]], uuid_str: str) -> str:
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
            
        nav_points = build_nav_points(toc_entries, 2)
        return TOC_NCX_TEMPLATE.format(
            uuid=uuid_str, depth=5, title="Random Sutta TPK", nav_points=nav_points
        )

    @staticmethod
    def build_nav_xhtml(toc_entries: List[Dict[str, Any]]) -> str:
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
            
        nav_list = build_nav_list(toc_entries, 2)
        return NAV_XHTML_TEMPLATE.format(title="Table of Contents", nav_list=nav_list)
