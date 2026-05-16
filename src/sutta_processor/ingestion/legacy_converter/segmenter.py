# Path: src/sutta_processor/ingestion/legacy_converter/segmenter.py
import re
from typing import List

class TextSegmenter:
    def __init__(self):
        # Dấu hiệu kết thúc câu tiếng Trung
        self.sentence_enders = re.compile(r'([。：？！])')

    def segment_text(self, text: str) -> List[str]:
        """Tách một đoạn văn bản thành các câu dựa trên dấu câu."""
        if not text:
            return []
        
        # Tách dựa trên regex, giữ lại dấu câu nhờ group ()
        parts = self.sentence_enders.split(text)
        
        sentences = []
        current_sentence = ""
        
        for part in parts:
            if not part:
                continue
            if self.sentence_enders.match(part):
                current_sentence += part
                sentences.append(current_sentence)
                current_sentence = ""
            else:
                current_sentence += part
                
        if current_sentence:
            sentences.append(current_sentence)
            
        # Xóa khoảng trắng thừa ở đầu/cuối mỗi câu (tùy chọn, SC thường để khoảng trắng ở cuối)
        # Tuy nhiên SC chuẩn thường có space sau mỗi câu.
        # Ở đây ta trả về nguyên trạng phân tách.
        return sentences
