import type { Storage } from "./types";

export async function createStorage(_options: {}): Promise<Storage> {
  return {
    documents: "documents",
  };
}
