import type { Template } from "@/template-engine/types";
import jumper from "./jumper.json";

/**
 * The full registry of dapp templates shipped with the extension.
 *
 * Order is significant only insofar as templates with overlapping match
 * patterns are evaluated top-down — most templates are domain-scoped so
 * collisions are unusual. Add a new dapp by importing its JSON and pushing
 * it onto this array.
 */
export const registry: Template[] = [jumper as Template];
