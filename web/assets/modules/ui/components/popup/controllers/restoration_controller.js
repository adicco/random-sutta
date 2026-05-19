// Path: web/assets/modules/ui/components/popup/controllers/restoration_controller.js
import { PopupState } from '../state/popup_state.js';
import { CommentController } from './comment_controller.js';
import { QuicklookController } from './quicklook_controller.js';
import { ParallelsController } from 'ui/components/parallels/parallels_controller.js';
import { Scroller } from 'ui/common/scroller.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("RestorationCtrl");

export const RestorationController = {
    restore() {
        const snapshot = PopupState.getSnapshot();
        
        if (!snapshot) {
            logger.debug("Restore", "No snapshot found.");
            return;
        }

        logger.info("Exec", `Analyzing snapshot...`, snapshot);

        let restoredAnything = false;

        // 1. Phục hồi Comment
        if (typeof snapshot.commentIndex === 'number' && snapshot.commentIndex !== -1) {
            if (PopupState.getComments().length === 0) {
                logger.info("Restore", "Rescanning comments...");
                CommentController.scanComments();
            }
            
            const comments = PopupState.getComments();
            if (snapshot.commentIndex < comments.length) {
                logger.info("Restore", `Restoring Comment at index: ${snapshot.commentIndex}`);
                
                CommentController.activate(snapshot.commentIndex, true);
                restoredAnything = true;

                // [FIXED] Restore Scroll & Highlight
                const item = comments[snapshot.commentIndex];
                if (item && item.id) {
                    Scroller.jumpTo(item.id); 
                    Scroller.highlightElement(item.id); // <--- Thêm dòng này
                }
            }
        }

        // 2. Phục hồi Quicklook
        if (snapshot.quicklookUrl) {
            logger.info("Restore", `Restoring Quicklook: ${snapshot.quicklookUrl}`);
            QuicklookController.handleLinkRequest(snapshot.quicklookUrl, true);
            restoredAnything = true;
        }

        // 3. Phục hồi Parallels
        if (snapshot.parallelsOpen) {
            logger.info("Restore", `Restoring Parallels Panel`);
            ParallelsController.open(true, true);
            restoredAnything = true;
        }

        if (!restoredAnything) {
            logger.debug("Restore", "Snapshot had no actionable data.");
        }
    }
};