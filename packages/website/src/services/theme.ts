import { EventEmitter } from "../utils/events";

export type ThemeVariant = "light" | "dark";

export interface ThemeServiceDeps {
  getPersistedThemeVariant: () => Promise<ThemeVariant | null>;
  setPersistedThemeVariant: (variant: ThemeVariant) => Promise<void>;
  removePersistedThemeVariant: () => Promise<void>;
}

export class ThemeService {
  initialized: Promise<void>;
  variant: ThemeVariant | null = null;

  onVariantUpdate = new EventEmitter<ThemeVariant | null>();

  private deps: ThemeServiceDeps;
  constructor(deps: ThemeServiceDeps) {
    this.deps = deps;
    this.initialized = (async () => {
      const variant = await deps.getPersistedThemeVariant();
      if (variant) {
        this.setThemeVariant(variant, false);
      }
    })();
  }

  async getThemeVariant() {
    await this.initialized;
    return this.variant;
  }

  async setThemeVariant(variant: ThemeVariant | null, store = true) {
    this.variant = variant;
    this.onVariantUpdate.emit(variant);

    if (store) {
      if (variant) {
        await this.deps.setPersistedThemeVariant(variant);
      } else {
        await this.deps.removePersistedThemeVariant();
      }
    }
  }
}
