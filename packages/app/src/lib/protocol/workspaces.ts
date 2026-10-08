export interface Workspace {
  id: string;
  name: string;
  visibleTabs: string[];
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'drafting',
    name: 'Drafting & Annotation',
    visibleTabs: ['home', 'annotate', 'view', 'parametric'],
  },
  {
    id: 'full',
    name: 'Full Interface',
    visibleTabs: ['home', 'annotate', 'view', 'insert', 'parametric'],
  },
  { id: 'minimal', name: 'Minimal', visibleTabs: ['home', 'view'] },
];
