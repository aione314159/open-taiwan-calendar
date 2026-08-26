import { moment as obsidianMoment } from "obsidian";
import type MomentFactory from "moment";
import type { Moment as MomentObject } from "moment";

/**
 * Obsidian's moment instance, typed against the moment package directly.
 *
 * Obsidian exports the instance as `typeof Moment`, where `Moment` is a
 * namespace import inside its own .d.ts. A checker that resolves obsidian.d.ts
 * without resolving that namespace ends up treating the export as untyped, and
 * every `moment()` call downstream becomes an unsafe call — which is exactly
 * what the community directory's automated review reported.
 *
 * The moment package is published as `export = moment`, so the annotation has
 * to come from a default import rather than a namespace one. `import * as` was
 * the first attempt and reads as the natural spelling, but under
 * `esModuleInterop` a namespace import of a `export =` module carries no call
 * signature, which left `moment()` untyped for exactly the checkers this file
 * exists to satisfy. A default import keeps the call signature under both
 * settings; the `Moment` object type comes from a separate named import
 * because a default import is not a namespace and cannot be indexed into.
 *
 * The assertion goes through `unknown` because obsidian.d.ts hits the same
 * namespace-import problem one level up: under `esModuleInterop` its own
 * `typeof Moment` has no call signature either, so the two types do not
 * overlap and a direct assertion is rejected. The instance is the moment
 * package's, so restating that is sound rather than a cast that hides a
 * mismatch.
 */
export const moment = obsidianMoment as unknown as typeof MomentFactory;

/** A moment object, as handed out and accepted by Obsidian's own API. */
export type Moment = MomentObject;
