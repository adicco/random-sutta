// Path: web/assets/modules/core/sutta/navigation.js

export const SuttaNavigation = {
  current: { prev: null, next: null },

  update(nav) {
    if (nav) {
      this.current = { prev: nav.prev, next: nav.next };
    } else {
      this.current = { prev: null, next: null };
    }
  },

  getPrev() {
    return this.current.prev;
  },

  getNext() {
    return this.current.next;
  }
};
