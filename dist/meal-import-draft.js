import {localDate, parseDay} from './core.js';
import {mealGroups} from './meal-import.js';

const key = owner => 'repnote:meal-photo-draft:'+owner;

function isReviewRow(row) {
  return row && typeof row.original?.name === 'string' && typeof row.values?.name === 'string' &&
    mealGroups.includes(row.values.meal) && typeof row.included === 'boolean' &&
    ['0.5','1','1.5','2','custom'].includes(row.scale);
}

export function readMealPhotoDraft(owner) {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(key(owner)));
    if (draft?.mode !== 'photo' || typeof draft.menu !== 'string' || typeof draft.response !== 'string' ||
        !mealGroups.includes(draft.group) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.day) ||
        localDate(parseDay(draft.day)) !== draft.day) return null;
    if (!Array.isArray(draft.previousReview) || draft.previousReview.length > 100 ||
        !draft.previousReview.every(isReviewRow)) draft.previousReview = [];
    return draft;
  } catch { return null; }
}

export function writeMealPhotoDraft(owner, day, draft) {
  try {
    if (!draft) {
      window.sessionStorage.removeItem(key(owner));
      return;
    }
    // Keep only the return form in this tab. The selected File and its preview stay in memory.
    const {mode, menu, response, group, stage, previousReview} = draft;
    window.sessionStorage.setItem(key(owner), JSON.stringify({day, mode, menu, response, group, stage, previousReview}));
  } catch {
    // On quota exhaustion don't restore an older answer as though it were the latest one.
    try { window.sessionStorage.removeItem(key(owner)); } catch {}
  }
}
