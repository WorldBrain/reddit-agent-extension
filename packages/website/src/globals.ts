import { createContext } from "react";
import { createServices } from "./services";
import { createStorage } from "./storage";
import type { Services } from "./services/types";
import type { Storage } from "./storage/types";

export const storage = await createStorage({});
export const services = createServices({ storage });

export type GlobalContextObject = {
  storage: Storage;
  services: Services;
};

export const GlobalContext = createContext<GlobalContextObject>({
  storage: storage,
  services: services,
});
