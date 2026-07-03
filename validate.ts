// pure validation logic: text in, findings out. no DOM, no UI.
// the UI (App.svelte) is purely a rendering of the Finding[] this returns —
// keeping the two apart is the core architecture contract (see CLAUDE.md).
//
// the validator is precompiled from the IIIF schema at build time
// (see scripts/build-validator.js). browser extensions forbid eval, and Ajv's
// normal runtime compilation uses new Function, so the ready-made validation
// function is imported here instead of compiling the schema at runtime.
import validateManifestStructure from "./manifest-validator.js";

// the one shape the whole app agrees on: validation produces a list of findings,
// and the UI is purely a rendering of that list.
export type Severity = "error" | "ok" | "warning";

export type Finding = {
  severity: Severity;
  message: string;
  // present for layered checks (L1, L2, …); omitted for plain status messages.
  layer?: number;
  // JSON Pointer to the offending value (e.g. "/items/0/type"), when the finding is
  // tied to a spot in the document. the UI uses it to place an editor marker.
  pointer?: string;
};

// layered validation: each layer only runs if the earlier ones passed.
export function validate(text: string): Finding[] {
  if (text.trim() === "") {
    return [
      {
        severity: "error",
        layer: 1,
        message: "Nothing to validate - paste a manifest first.",
      },
    ];
  }

  // layer 1: can the JSON be parsed?
  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return [
      {
        severity: "error",
        layer: 1,
        message: "Invalid JSON: " + reason,
      },
    ];
  }

  const findings: Finding[] = [
    { severity: "ok", layer: 1, message: "Layer 1 passed - well-formed JSON." },
  ];

  // layer 2: does the parsed manifest match the IIIF Presentation 3.0 structure?
  const matchesSchema = validateManifestStructure(parsedManifest);
  if (matchesSchema) {
    findings.push({
      severity: "ok",
      layer: 2,
      message: "Layer 2 passed - matches the IIIF Presentation 3.0 structure.",
    });
    // layer 4: best-practice lint only makes sense once the structure is valid.
    findings.push(...lintBestPractices(parsedManifest));
  } else {
    for (const schemaError of validateManifestStructure.errors ?? []) {
      const location = schemaError.instancePath || "(root)";
      findings.push({
        severity: "error",
        layer: 2,
        message: `${location} ${schemaError.message ?? "is invalid"}`,
        pointer: schemaError.instancePath,
      });
    }
  }

  return findings;
}

// layer 4: things that are valid but not recommended by the IIIF spec. warnings, not
// errors. ponytail: a small growable set of high-value checks, not the full recommendation
// list — add rules as real manifests surface them.
function lintBestPractices(manifest: unknown): Finding[] {
  const warnings: Finding[] = [];
  if (!isRecord(manifest)) {
    return warnings;
  }

  if (typeof manifest.id === "string" && manifest.id.startsWith("http://")) {
    warnings.push(warn("Manifest id uses http; https is recommended."));
  }

  if (isRecord(manifest.label) && "none" in manifest.label) {
    warnings.push(
      warn('Manifest label uses "none"; a BCP-47 language code (e.g. "en") is recommended.'),
    );
  }

  if (manifest.thumbnail === undefined) {
    warnings.push(warn("Manifest has no thumbnail; one is recommended for previews."));
  }

  if (manifest.metadata === undefined) {
    warnings.push(warn("Manifest has no metadata; descriptive metadata is recommended."));
  }

  if (Array.isArray(manifest.items)) {
    const unlabeled = manifest.items.filter(
      (item) => isRecord(item) && item.label === undefined,
    ).length;
    if (unlabeled > 0) {
      warnings.push(warn(`${unlabeled} canvas(es) have no label; labels are recommended.`));
    }
  }

  return warnings;
}

function warn(message: string): Finding {
  return { severity: "warning", layer: 4, message };
}

// content resources whose id should actually dereference. canvas/service/manifest-child
// identifiers are deliberately excluded — in IIIF those need not resolve.
const contentResourceTypes = new Set(["Image", "Sound", "Video", "Text", "Dataset"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

// collect the http(s) URLs worth fetching: the manifest's own id plus every nested
// content resource id. deduped.
function collectResourceUrls(manifest: unknown): string[] {
  const urls = new Set<string>();

  if (isRecord(manifest) && typeof manifest.id === "string" && isHttpUrl(manifest.id)) {
    urls.add(manifest.id);
  }

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (!isRecord(value)) {
      return;
    }
    if (
      typeof value.type === "string" &&
      contentResourceTypes.has(value.type) &&
      typeof value.id === "string" &&
      isHttpUrl(value.id)
    ) {
      urls.add(value.id);
    }
    for (const key of Object.keys(value)) {
      walk(value[key]);
    }
  }
  walk(manifest);

  return [...urls];
}

// returns a finding on failure, undefined on success.
async function checkUrl(url: string): Promise<Finding | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    // the status line is all we need — cancel the body so the browser doesn't
    // download entire images/videos just to prove they exist.
    void response.body?.cancel();
    if (!response.ok) {
      return {
        severity: "error",
        layer: 3,
        message: `${response.status} ${response.statusText} - ${url}`,
      };
    }
    return undefined;
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    const reason = timedOut
      ? "timed out after 10s"
      : error instanceof Error
        ? error.message
        : String(error);
    return { severity: "error", layer: 3, message: `Unreachable (${reason}) - ${url}` };
  }
}

// layer 3: do the URLs the manifest references actually resolve? this is the extension's
// edge — host_permissions let it fetch cross-origin. network-bound, so it is async and a
// separate action rather than part of the sync validate().
export async function validateLinks(text: string): Promise<Finding[]> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    return [{ severity: "error", layer: 1, message: "Invalid JSON - fix Layer 1 first." }];
  }

  const urls = collectResourceUrls(manifest);
  if (urls.length === 0) {
    return [
      { severity: "ok", layer: 3, message: "Layer 3: no resolvable resource URLs found." },
    ];
  }

  // ponytail: cap requests so a huge manifest can't fire hundreds at once; the summary
  // reports how many of the total were actually checked. raise if it proves too low.
  const maxUrls = 25;
  const checked = urls.slice(0, maxUrls);
  const results = await Promise.all(checked.map(checkUrl));
  const failures = results.filter((finding): finding is Finding => finding !== undefined);

  const summary: Finding = {
    severity: failures.length > 0 ? "error" : "ok",
    layer: 3,
    message:
      failures.length > 0
        ? `Layer 3: ${failures.length} of ${checked.length} checked failed (of ${urls.length} found).`
        : `Layer 3 passed - ${checked.length} of ${urls.length} resource(s) resolved.`,
  };

  return [summary, ...failures];
}
