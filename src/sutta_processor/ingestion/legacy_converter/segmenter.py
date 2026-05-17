# Path: src/sutta_processor/ingestion/legacy_converter/segmenter.py
import re
from typing import List

class TextSegmenter:
    def __init__(self):
        # Dấu hiệu kết thúc câu tiếng Trung, bao gồm cả dấu ngoặc đóng theo sau (nếu có)
        self.sentence_enders = re.compile(r'([。：？！]+[」』”"’\']?)')

    def segment_text(self, text: str) -> List[str]:
        """Tách một đoạn văn bản thành các câu dựa trên dấu câu."""
        if not text:
            return []
        
        # Tách dựa trên regex, giữ lại dấu câu + dấu ngoặc đóng
        # split() sẽ trả về mảng: [text, ender, text, ender, ...]
        parts = self.sentence_enders.split(text)
        
        sentences = []
        
        # Vì ender nằm trong capture group nên nó sẽ xuất hiện trong mảng parts
        # Ta ghép cặp (văn bản + dấu kết thúc)
        for i in range(0, len(parts) - 1, 2):
            combined = (parts[i] + parts[i+1]).strip()
            if combined:
                sentences.append(combined)
        
        # Xử lý phần văn bản thừa ở cuối (nếu không có dấu kết thúc)
        last_part = parts[-1].strip()
        if last_part:
            sentences.append(last_part)
            
        return sentences
