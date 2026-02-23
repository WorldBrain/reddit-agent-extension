import { createServices } from "../services";
import type { MainProgramSetup } from "./types";
import { createStorage } from "../storage";

export async function mainProgram(): Promise<MainProgramSetup> {
  const storage = await createStorage({});
  const services = createServices({
    storage,
  });

  return {
    storage,
    services,
  };
}
