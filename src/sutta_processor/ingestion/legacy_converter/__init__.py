# Path: src/sutta_processor/ingestion/legacy_converter/__init__.py
from .orchestrator import ConversionOrchestrator

def run_legacy_conversion():
    orchestrator = ConversionOrchestrator()
    orchestrator.run_batch()

__all__ = ["run_legacy_conversion"]
