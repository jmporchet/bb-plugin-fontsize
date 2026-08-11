// bb-plugin-fontsize — backend entry.
//
// Deliberately empty. Font size is a per-device preference held in each
// client's local storage, so there is nothing for the server to store, sync,
// or serve. `bb.server` is required by the manifest, so this factory exists
// only to register the plugin.
import type { BbPluginApi } from "@bb/plugin-sdk";

export default function plugin(bb: BbPluginApi) {
  bb.log.info("loaded (frontend-only plugin)");
}
