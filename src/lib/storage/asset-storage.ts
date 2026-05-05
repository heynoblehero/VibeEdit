/**
 * Storage adapter for cross-project libraries (AssetLibraryStore,
 * SavedStylesStore). Today the implementation is localStorage, but the
 * stores never see that — they call `assetStorage.getItem/setItem`
 * which routes through whatever adapter is registered. When auth +
 * Drizzle/SQLite land, we swap the adapter once at boot and every
 * library entry persists to the DB without touching store code.
 *
 * The adapter shape matches Zustand's StateStorage so it drops
 * straight into `createJSONStorage(() => assetStorage)` in each store.
 */

export interface StorageAdapter {
	getItem(key: string): string | null | Promise<string | null>;
	setItem(key: string, value: string): void | Promise<void>;
	removeItem(key: string): void | Promise<void>;
}

const noopAdapter: StorageAdapter = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};

export const localStorageAdapter: StorageAdapter = {
	getItem(key) {
		if (typeof window === "undefined") return null;
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key, value) {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(key, value);
		} catch {
			// Out-of-space / private mode — silently swallow so the UI keeps
			// running. The store still has the value in memory for this session.
		}
	},
	removeItem(key) {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.removeItem(key);
		} catch {
			// Same as above — never crash the app on a storage hiccup.
		}
	},
};

let activeAdapter: StorageAdapter =
	typeof window === "undefined" ? noopAdapter : localStorageAdapter;

/** Hot-swap the active adapter. Call once at app boot when a non-default
 *  backend (e.g. Drizzle, IndexedDB) is ready. */
export function setStorageAdapter(adapter: StorageAdapter): void {
	activeAdapter = adapter;
}

/** The single proxy passed to Zustand's `createJSONStorage`. Indirects
 *  every read/write through whatever adapter is active right now. */
export const assetStorage: StorageAdapter = {
	getItem: (key) => activeAdapter.getItem(key),
	setItem: (key, value) => activeAdapter.setItem(key, value),
	removeItem: (key) => activeAdapter.removeItem(key),
};

/** Storage keys — kept here so the future DB adapter has a single
 *  source of truth for what shapes get persisted under what name. */
export const STORAGE_KEYS = {
	assetLibrary: "vibeedit-asset-library",
	savedStyles: "vibeedit-saved-styles",
} as const;
