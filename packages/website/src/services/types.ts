import { ThemeService } from "./theme";
import { CacheService } from "./cache";
import { EventEmitter } from "../utils/events";

export type Services = {
  events: EventEmitter<any>;
  cache: CacheService;
  theme: ThemeService;
};
