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
    summary: { en: ["A clean example manifest."] },
    thumbnail: [{ id: "https://example.org/thumb.jpg", type: "Image" }],
    metadata: [{ label: { en: ["Date"] }, value: { en: ["1900"] } }],
    rights: "http://creativecommons.org/publicdomain/zero/1.0/",
    provider: [
      { id: "https://example.org/about", type: "Agent", label: { en: ["Example Org"] } },
    ],
    items: [
      {
        id: "https://example.org/canvas/1",
        type: "Canvas",
        label: { en: ["Page 1"] },
        height: 100,
        width: 100,
        items: [{ id: "https://example.org/page/1", type: "AnnotationPage" }],
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

  test("a canvas without dimensions or duration collapses to one readable error", () => {
    const manifest = cleanManifest();
    manifest.items = [{ id: "https://example.org/canvas/1", type: "Canvas" }];
    const findings = validate(JSON.stringify(manifest));
    const canvasErrors = errors(findings).filter((finding) =>
      finding.pointer?.startsWith("/items/0"),
    );
    // Ajv's raw output is four errors (three required + one anyOf); the anyOf branch
    // noise is collapsed into a single finding that names the alternatives.
    expect(canvasErrors).toHaveLength(1);
    expect(canvasErrors[0].message).toContain("must have height + width, or duration");
  });

  test("L4 lint does not run when L2 fails", () => {
    const manifest = { ...cleanManifest(), type: 123 };
    const findings = validate(JSON.stringify(manifest));
    expect(warnings(findings)).toHaveLength(0);
  });

  test("an empty items array is a spec violation, not a warning", () => {
    const manifest = { ...cleanManifest(), items: [] };
    const findings = validate(JSON.stringify(manifest));
    const itemErrors = errors(findings).filter((finding) => finding.pointer === "/items");
    expect(itemErrors).toHaveLength(1);
    expect(itemErrors[0].message).toContain("fewer than 1 items");
  });

  test("an @context without the Presentation 3 URI is rejected", () => {
    const manifest = { ...cleanManifest(), "@context": "http://example.org/wrong.json" };
    const findings = validate(JSON.stringify(manifest));
    const contextErrors = errors(findings).filter(
      (finding) => finding.pointer === "/@context",
    );
    expect(contextErrors.length).toBeGreaterThan(0);
  });

  test("a canvas id with a fragment is rejected", () => {
    const manifest = cleanManifest();
    const canvas = (manifest.items as Record<string, unknown>[])[0];
    canvas.id = "https://example.org/canvas/1#fragment";
    const findings = validate(JSON.stringify(manifest));
    const idErrors = errors(findings).filter(
      (finding) => finding.pointer === "/items/0/id",
    );
    expect(idErrors).toHaveLength(1);
  });
});

describe("layer 4 - best-practice lint", () => {
  test("a clean manifest produces no warnings", () => {
    const findings = validate(JSON.stringify(cleanManifest()));
    expect(warnings(findings)).toHaveLength(0);
  });

  test("all lint rules fire on a worst-practice manifest", () => {
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
    expect(messages).toHaveLength(9);
    expect(messages.join("\n")).toContain("https is recommended");
    expect(messages.join("\n")).toContain('label uses "none"');
    expect(messages.join("\n")).toContain("no summary");
    expect(messages.join("\n")).toContain("no thumbnail");
    expect(messages.join("\n")).toContain("no metadata");
    expect(messages.join("\n")).toContain("no rights or requiredStatement");
    expect(messages.join("\n")).toContain("no provider");
    expect(messages.join("\n")).toContain("have no label");
    expect(messages.join("\n")).toContain("have no content");
  });
});
