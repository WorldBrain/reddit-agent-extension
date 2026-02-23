import type { Services } from "../services/types";
import type { Storage } from "../storage/types";

export interface MainProgramSetup {
  storage: Storage;
  services: Services;
}
