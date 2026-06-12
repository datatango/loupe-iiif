// runs in workbench tab
// The validator is precompiled from the IIIF schema at build time
// (see scripts/build-validator.js). Browser extensions forbid eval, and Ajv's
// normal runtime compilation uses new Function, so we import the ready-made
// validation function instead of compiling the schema here.
import validateManifestStructure from "./manifest-validator.js";

const input = document.getElementById("input");
const report = document.getElementById("report");

document.getElementById("validate").addEventListener("click", () => {
  render(validate(input.value));
});

// Runs Layer 1 (well-formed JSON) then Layer 2 (IIIF Presentation 3.0 structure).
function validate(text) {
  if (text.trim() === "") {
    return [
      {
        severity: "error",
        layer: 1,
        message: "Nothing to validate - paste a manifest first.",
      },
    ];
  }

  // Layer 1: is it parseable JSON at all?
  let parsedManifest;
  try {
    parsedManifest = JSON.parse(text);
  } catch (error) {
    return [
      { severity: "error", layer: 1, message: "Invalid JSON: " + error.message },
    ];
  }

  const findings = [
    { severity: "ok", layer: 1, message: "Layer 1 passed - well-formed JSON." },
  ];

  // Layer 2: does the parsed manifest match the IIIF Presentation 3.0 structure?
  const matchesSchema = validateManifestStructure(parsedManifest);
  if (matchesSchema) {
    findings.push({
      severity: "ok",
      layer: 2,
      message: "Layer 2 passed - matches the IIIF Presentation 3.0 structure.",
    });
  } else {
    for (const schemaError of validateManifestStructure.errors) {
      const location = schemaError.instancePath || "(root)";
      findings.push({
        severity: "error",
        layer: 2,
        message: `${location} ${schemaError.message}`,
      });
    }
  }

  return findings;
}

// load from url button
document.getElementById("load").addEventListener("click", async () => {
  const url = document.getElementById("url").value.trim();
  if (!url) {
    render([{ severity: "error", message: "Enter a manifest URL first." }]);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      render([
        {
          severity: "error",
          message: `Fetch failed: HTTP ${res.status} ${res.statusText}`,
        },
      ]);
      return;
    }
    input.value = await res.text();
    render([
      { severity: "ok", message: `Loaded ${url} - now click Validate.` },
    ]);
  } catch (err) {
    render([{ severity: "error", message: "Could not fetch: " + err.message }]);
  }
});

// shared renderer
function render(findings) {
  report.innerHTML = "";
  for (const f of findings) {
    const el = document.createElement("div");
    el.className = "finding " + f.severity;
    el.textContent = (f.layer ? `[L${f.layer}] ` : "") + f.message;
    report.appendChild(el);
  }
}
