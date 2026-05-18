// Path: web/assets/modules/ui/components/parallels/index.js
import { setupParallelsPanel } from './parallels_controller.js';

export const ParallelsComponent = {
    createInstance: () => setupParallelsPanel()
};