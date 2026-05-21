# Path: src/dict_builder/__main__.py
import argparse
from concurrent.futures import ThreadPoolExecutor
from .logging_setup import setup_dict_builder_logging
# [UPDATED] Import thêm run_view_injector, run_zip_packager
from .dict_builder_app import run_builder_with_export, run_view_injector, run_zip_packager
from .logic.db_converter import DbConverter
from .builder_config import BuilderConfig
from .logic.builder_exporter import BuilderExporter

logger = setup_dict_builder_logging()

def main():
    parser = argparse.ArgumentParser(description="DPD Dictionary Builder CLI")
    
    # Mode selection
    group = parser.add_mutually_exclusive_group()
    group.add_argument("-t", "--tiny", action="store_true", help="Build tiny version")
    group.add_argument("-m", "--mini", action="store_true", help="Build mini version (Default)")
    group.add_argument("-f", "--full", action="store_true", help="Build full version")
    group.add_argument("-a", "--all", action="store_true", help="Build ALL versions sequentially")
    
    # [NEW] View Injection Flag
    parser.add_argument("-v", "--view", action="store_true", help="Inject/Update Search Views ONLY (No Data Rebuild)")

    # [NEW] Zip Packaging Flag
    parser.add_argument("-z", "--zip", action="store_true", help="Zip existing DB and export to Web Assets ONLY (No Build)")

    parser.add_argument("-e", "--export", dest="export_flag", action="store_true", help="Export to web assets")

    args = parser.parse_args()

    # Determine modes
    modes_to_run = []
    if args.all: modes_to_run = ["mini", "tiny", "full"] 
    elif args.tiny: modes_to_run = ["tiny"]
    elif args.full: modes_to_run = ["full"]
    else: modes_to_run = ["mini"] # Default target is always mini unless specified

    # Determine actions
    explicit_build = args.all or args.tiny or args.mini or args.full
    is_default_run = not (args.view or args.zip or explicit_build)
    
    should_build = explicit_build or is_default_run

    # --- STEP 1: VIEW INJECTION (-v) ---
    if args.view:
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]")
        logger.info(f"[bold magenta]🔮 VIEW INJECTION MODE (Parallel)[/bold magenta]")
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]\n")
        
        with ThreadPoolExecutor() as executor:
            executor.map(lambda m: run_view_injector(mode=m), modes_to_run)

    # --- STEP 2: DATA BUILD (-m, -t, -f, -a, or Default) ---
    if should_build:
        # If -z is present with build, treat it as export (-e)
        if args.zip: 
            args.export_flag = True

        processed_modes = set()
        has_mini = "mini" in modes_to_run

        # We must build MINI first if TINY is requested to use Smart Build
        if has_mini and "tiny" in modes_to_run:
            logger.info(f"[bold yellow]🚀 Building MINI first to enable Smart Build for TINY...[/bold yellow]")
            try:
                run_builder_with_export(mode="mini", export_flag=args.export_flag)
                processed_modes.add("mini")
            except Exception as e:
                logger.error(f"Mini build failed: {e}")

        remaining_modes = [m for m in modes_to_run if m not in processed_modes]
        
        def build_task(mode):
            if mode == "tiny" and "mini" in processed_modes:
                logger.info(f"[bold yellow]⚡ SMART BUILD: Converting MINI -> TINY[/bold yellow]")
                mini_conf = BuilderConfig(mode="mini")
                tiny_conf = BuilderConfig(mode="tiny")
                if DbConverter.create_tiny_from_mini(mini_conf, tiny_conf):
                    if args.export_flag:
                        BuilderExporter.export_to_web(tiny_conf.output_path, tiny_conf.WEB_OUTPUT_DIR)
                    return f"tiny (Smart)"
            
            logger.info(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()} (JSON)[/bold yellow]")
            run_builder_with_export(mode=mode, export_flag=args.export_flag)
            return mode

        if remaining_modes:
            # Limit concurrent builds to 2 to avoid system overload (especially if "full" is involved)
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(build_task, remaining_modes))
                logger.info(f"✅ Completed builds: {', '.join(results)}")

    # --- STEP 3: ZIP PACKAGING (-z WITHOUT Build) ---
    if args.zip and not should_build:
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]")
        logger.info(f"[bold magenta]📦 ZIP PACKAGING MODE (Parallel, No Build)[/bold magenta]")
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]\n")
        
        with ThreadPoolExecutor() as executor:
            executor.map(lambda m: run_zip_packager(mode=m), modes_to_run)

if __name__ == "__main__":
    main()

if __name__ == "__main__":
    main()