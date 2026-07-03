// locks down the validate() contract: text in, Finding[] out, layered L1/L2/L4.
// run with `npm test` (the pretest hook regenerates manifest-validator.js first).
import { describe, expect, test } from "vitest";
import { validate, type Finding } from "./validate";

// a manifest that passes L2 and trips none of the L4 lint rules.
function cleanManifest(): Record<string, unknown> {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "https://example.org/manifest",
    type: "Manifest",
    label: { en: ["Clean example"] },
    thumbnail: [{ id: "https://example.org/thumb.jpg", type: "Image" }],
    metadata: [{ label: { en: ["Date"] }, value: { en: ["1900"] } }],
    items: [
      {
        id: "https://example.org/canvas/1",
        type: "Canvas",
        label: { en: ["Page 1"] },
        height: 100,
        width: 100,
      },
    ],
  };
}

function errors(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === "error");
}

function warnings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === "warning");
}

describe("layer 1 - JSON well-formedness", () => {
  test("empty input is a single L1 error", () => {
    const findings = validate("   ");
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].layer).toBe(1);
  });

  test("malformed JSON is a single L1 error", () => {
    const findings = validate('{"trailing": true,}');
    expect(findings).toHaveLength(1);
    expect(findings[0].layer).toBe(1);
    expect(findings[0].message).toContain("Invalid JSON");
  });
});

describe("layer 2 - IIIF structure", () => {
  test("a clean manifest passes L1 and L2 with no errors", () => {
    const findings = validate(JSON.stringify(cleanManifest()));
    expect(errors(findings)).toHaveLength(0);
    const okLayers = findings
      .filter((finding) => finding.severity === "ok")
      .map((finding) => finding.layer);
    expect(okLayers).toEqual([1, 2]);
  });

  test("a wrong-typed field carries a pointer to it", () => {
    const manifest = { ...cleanManifest(), type: 123 };
    const findings = validate(JSON.stringify(manifest));
    const typeErrors = errors(findings).filter((finding) => finding.pointer === "/type");
    expect(typeErrors.length).toBeGreaterThan(0);
    expect(typeErrors[0].layer).toBe(2);
  });

  test("a missing required property points at the root (empty pointer)", () => {
    const manifest = cleanManifest();
    delete manifest.id;
    const findings = validate(JSON.stringify(manifest));
    const rootErrors = errors(findings).filter((finding) => finding.pointer === "");
    expect(rootErrors.length).toBeGreaterThan(0);
    expect(rootErrors[0].message).toContain("'id'");
  });

  test("a canvas without dimensions or duration is flagged at its path", () => {
    const manifest = cleanManifest();
    manifest.items = [{ id: "https://example.org/canvas/1", type: "Canvas" }];
    const findings = validate(JSON.stringify(manifest));
    const canvasErrors = errors(findings).filter((finding) =>
      finding.pointer?.startsWith("/items/0"),
    );
    expect(canvasErrors.length).toBeGreaterThan(0);
  });

  test("L4 lint does not run when L2 fails", () => {
    const manifest = { ...cleanManifest(), type: 123 };
    const findings = validate(JSON.stringify(manifest));
    expect(warnings(findings)).toHaveLength(0);
  });
});

describe("layer 4 - best-practice lint", () => {
  test("a clean manifest produces no warnings", () => {
    const findings = validate(JSON.stringify(cleanManifest()));
    expect(warnings(findings)).toHaveLength(0);
  });

  test("all five lint rules fire on a worst-practice manifest", () => {
    const manifest = {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "http://example.org/manifest",
      type: "Manifest",
      label: { none: ["Untranslated"] },
      items: [
        {
          id: "https://example.org/canvas/1",
          type: "Canvas",
          height: 100,
          width: 100,
        },
      ],
    };
    const findings = validate(JSON.stringify(manifest));
    const messages = warnings(findings).map((finding) => finding.message);
    expect(messages).toHaveLength(5);
    expect(messages.join("\n")).toContain("https is recommended");
    expect(messages.join("\n")).toContain('label uses "none"');
    expect(messages.join("\n")).toContain("no thumbnail");
    expect(messages.join("\n")).toContain("no metadata");
    expect(messages.join("\n")).toContain("have no label");
  });
});
