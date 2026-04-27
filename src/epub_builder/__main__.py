# Path: src/epub_builder/__main__.py
import sys
import logging
from .cli import parse_args
from .epub_generator import EpubGenerator

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    logger = logging.getLogger("EpubBuilder")
    
    args = parse_args()
    
    if not args.db_dir.exists():
        logger.error(f"❌ Database directory not found: {args.db_dir}")
        logger.error("Please run the Sutta Processor build first to generate databases.")
        sys.exit(1)
        
    generator = EpubGenerator(output_path=args.output, db_dir=args.db_dir)
    
    try:
        generator.build()
    except Exception as e:
        logger.exception(f"❌ Failed to build EPUB: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
