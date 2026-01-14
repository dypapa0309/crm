const state = {
  route: "dashboard",
  q: "",
  stages: [],
  deals: [],
  companies: [],
  contacts: [],
  activities: [],
  tasks: [],
  ui: {
    dealPanelOpen: false,
    activeDealId: null,
    dealsList: null,
  }
};

const listeners = new Set();

export function getState(){ return state; }

export function setState(patch){
  Object.assign(state, patch);
  emit();
}

export function patchState(fn){
  fn(state);
  emit();
}

export function subscribe(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(){
  for(const fn of listeners) fn(state);
}
