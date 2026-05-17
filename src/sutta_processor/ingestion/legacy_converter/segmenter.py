# Path: src/sutta_processor/ingestion/legacy_converter/segmenter.py
import re
from typing import List

class TextSegmenter:
    def __init__(self):
        # Dấu hiệu kết thúc câu tiếng Trung, bao gồm cả dấu ngoặc đóng theo sau (nếu có)
        # Bổ sung dấu chấm phẩy (;) và (；) để chẻ nhỏ các câu kệ
        # Bổ sung khoảng trắng kép (　　) để tách 2 vế của câu kệ
        self.sentence_enders = re.compile(r'([。：？！；;]+[」』”"’\']?|　　)')

    def segment_text(self, text: str) -> List[str]:
        """Tách một đoạn văn bản thành các câu dựa trên dấu câu hoặc khoảng trắng kép."""
        if not text:
            return []
        
        # Tách dựa trên regex, giữ lại dấu câu + dấu ngoặc đóng
        parts = self.sentence_enders.split(text)
        
        sentences = []
        
        for i in range(0, len(parts) - 1, 2):
            content = parts[i]
            ender = parts[i+1]
            
            # Nếu ender là khoảng trắng kép, ta không gộp nó vào text (để CSS Grid lo)
            if ender == "　　":
                if content.strip():
                    sentences.append(content.strip())
            else:
                combined = (content + ender).strip()
                if combined:
                    sentences.append(combined)
        
        # Xử lý phần văn bản thừa ở cuối
        last_part = parts[-1].strip()
        if last_part:
            sentences.append(last_part)
            
        return sentences
