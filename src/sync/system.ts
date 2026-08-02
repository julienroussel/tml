"use client";

import { PowerSyncDatabase } from "@powersync/web";
import { appSchema } from "./schema";

// @powersync/web 2.0 merged the separate database and sync worker bundles into
// a single file and dropped the UMD build, so both worker entries below point
// at the same script. `postinstall` copies it to public/ (see package.json).
// This constant must match the worker filename `powersync-web copy-assets`
// (run by `postinstall`) emits into public/. If it 404s, PowerSync silently
// degrades rather than failing loudly, and no automated gate catches that
// drift today.
const POWERSYNC_WORKER = "/powersync/worker.js";

export const powerSyncDb = new PowerSyncDatabase({
  // 2.0 removed the need for WASQLiteOpenFactory: open options live directly on
  // `database` (the former `flags.disableSSRWarning` moved here too).
  database: {
    dbFilename: "themagiclab.db",
    disableSSRWarning: true,
    worker: POWERSYNC_WORKER,
  },
  schema: appSchema,
  sync: {
    worker: POWERSYNC_WORKER,
  },
});
