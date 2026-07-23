// Remembers the last tab/filter a user had open on the Surveys and One-on-Ones
// list pages, so returning via the top nav (not a contextual back button)
// lands back where they left off instead of resetting to the default view.
// Session-scoped (cleared on logout/new tab) rather than permanent.

export type SurveyScope = 'created' | 'targeted';
export type SurveyStatusTab = 'draft' | 'active' | 'completed' | 'closed';

export interface SurveyListView {
  scope: SurveyScope;
  statusTab: SurveyStatusTab;
}

const SURVEY_VIEW_KEY = 'pulse:surveyListView';
const defaultSurveyView: SurveyListView = { scope: 'targeted', statusTab: 'active' };

export function getSurveyListView(): SurveyListView {
  try {
    const raw = sessionStorage.getItem(SURVEY_VIEW_KEY);
    if (raw) return { ...defaultSurveyView, ...JSON.parse(raw) };
  } catch {
    // ignore malformed storage
  }
  return defaultSurveyView;
}

export function setSurveyListView(view: SurveyListView) {
  sessionStorage.setItem(SURVEY_VIEW_KEY, JSON.stringify(view));
}

export function surveyListViewLabel(view: SurveyListView): string {
  if (view.scope === 'targeted') {
    if (view.statusTab === 'closed') return 'Closed';
    if (view.statusTab === 'completed') return 'Completed';
    return 'Pending';
  }
  if (view.statusTab === 'draft') return 'Drafts';
  return view.statusTab === 'closed' ? 'Closed' : 'Active';
}

export type OneOnOneTab = 'assigned' | 'initiated';
export type OneOnOneAssignedFilter = 'todo' | 'completed';
export type OneOnOneInitiatedFilter = 'draft' | 'published';

export interface OneOnOneListView {
  tab: OneOnOneTab;
  assignedFilter: OneOnOneAssignedFilter;
  initiatedFilter: OneOnOneInitiatedFilter;
}

const ONE_ON_ONE_VIEW_KEY = 'pulse:oneOnOneListView';
const defaultOneOnOneView: OneOnOneListView = { tab: 'assigned', assignedFilter: 'todo', initiatedFilter: 'draft' };

export function getOneOnOneListView(): OneOnOneListView {
  try {
    const raw = sessionStorage.getItem(ONE_ON_ONE_VIEW_KEY);
    if (raw) return { ...defaultOneOnOneView, ...JSON.parse(raw) };
  } catch {
    // ignore malformed storage
  }
  return defaultOneOnOneView;
}

export function setOneOnOneListView(view: OneOnOneListView) {
  sessionStorage.setItem(ONE_ON_ONE_VIEW_KEY, JSON.stringify(view));
}

export function oneOnOneListViewLabel(view: OneOnOneListView): string {
  if (view.tab === 'assigned') {
    return view.assignedFilter === 'completed' ? 'Completed' : 'To do';
  }
  return view.initiatedFilter === 'published' ? 'Published' : 'Drafts';
}
