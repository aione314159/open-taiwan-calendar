import { moment as obsidianMoment } from "obsidian";
import type * as MomentApi from "moment";

/**
 * Obsidian's moment instance, typed against the moment package directly.
 *
 * Obsidian exports the instance as `typeof Moment`, where `Moment` is a
 * namespace import inside its own .d.ts. A checker that resolves obsidian.d.ts
 * without resolving that namespace ends up treating the export as untyped, and
 * every `moment()` call downstream becomes an unsafe call — which is exactly
 * what the community directory's automated review reported.
 *
 * Re-exporting it under an explicit type annotation pins it to the moment
 * package this plugin already depends on. An annotation rather than an
 * assertion: it is redundant where obsidian.d.ts resolves fully, and lint
 * would flag the assertion as unnecessary there.
 */
export const moment: typeof MomentApi = obsidianMoment;

/** A moment object, as handed out and accepted by Obsidian's own API. */
export type Moment = MomentApi.Moment;
