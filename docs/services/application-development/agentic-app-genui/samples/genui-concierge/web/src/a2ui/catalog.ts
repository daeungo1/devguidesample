"use client";

import { createCatalog } from "@copilotkit/a2ui-renderer";
import { BUNDLE_CATALOG_ID, bundleDefinitions } from "./definitions";
import { bundleRenderers } from "./renderers";

export const bundleCatalog = createCatalog(bundleDefinitions, bundleRenderers, {
  catalogId: BUNDLE_CATALOG_ID,
  includeBasicCatalog: true,
});
