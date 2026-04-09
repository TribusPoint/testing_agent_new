/**
 * This file is kept for backward compatibility.
 * All logic has moved to ./api/ — import from "@/lib/api" resolves to ./api/index.ts.
 *
 * If your imports already use `@/lib/api`, they will resolve to this file *or*
 * the api/ directory depending on module resolution. To avoid ambiguity,
 * this file re-exports everything from the new modules.
 */
export * from "./api/index";
