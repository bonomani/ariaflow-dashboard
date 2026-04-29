// Bundle entry. Attaches migrated modules to `window` so the legacy
// classic-script `app.js` and Alpine callbacks can keep finding them
// during the JS-to-TS migration. Modules are removed from `window`
// once all callers have been migrated to ES imports.

import { renderItemSparkline, renderGlobalSparkline } from './sparkline';
import {
  formatEta,
  formatBytes,
  formatRate,
  formatMbps,
  humanCap,
  shortName,
  relativeTime,
  timestampLabel,
  badgeClass,
  sessionLabel,
} from './formatters';

declare global {
  interface Window {
    renderItemSparkline: typeof renderItemSparkline;
    renderGlobalSparkline: typeof renderGlobalSparkline;
    formatEta: typeof formatEta;
    formatBytes: typeof formatBytes;
    formatRate: typeof formatRate;
    formatMbps: typeof formatMbps;
    humanCap: typeof humanCap;
    shortName: typeof shortName;
    relativeTime: typeof relativeTime;
    timestampLabel: typeof timestampLabel;
    badgeClass: typeof badgeClass;
    sessionLabel: typeof sessionLabel;
  }
}

window.renderItemSparkline = renderItemSparkline;
window.renderGlobalSparkline = renderGlobalSparkline;
window.formatEta = formatEta;
window.formatBytes = formatBytes;
window.formatRate = formatRate;
window.formatMbps = formatMbps;
window.humanCap = humanCap;
window.shortName = shortName;
window.relativeTime = relativeTime;
window.timestampLabel = timestampLabel;
window.badgeClass = badgeClass;
window.sessionLabel = sessionLabel;
