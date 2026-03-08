import { v7 } from "uuid";

/**
 * Generate a UUID v7
 * @returns The generated UUID
 */
export function generateUUID() {
  return v7();
}