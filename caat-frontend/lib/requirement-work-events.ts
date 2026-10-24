/** Known writes in the current page must refresh requirement previews and
 * cascade removals. Cross-tab changes refresh when the window regains focus. */
export const REQUIREMENT_WORK_CHANGED = 'caat:requirement-work-changed';
export function notifyRequirementWorkChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REQUIREMENT_WORK_CHANGED));
}
