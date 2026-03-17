"use client";

import { PowerSyncDatabase, WASQLiteOpenFactory } from "@powersync/web";
import { appSchema } from "./schema";

const factory = new WASQLiteOpenFactory({
  dbFilename: "themagiclab.db",
  worker: "/@powersync/worker/WASQLiteDB.umd.js",
});

export const powerSyncDb = new PowerSyncDatabase({
  database: factory,
  schema: appSchema,
  flags: {
    disableSSRWarning: true,
  },
  sync: {
    worker: "/@powersync/worker/SharedSyncImplementation.umd.js",
  },
});
