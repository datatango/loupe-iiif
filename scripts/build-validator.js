// precompiles the IIIF schema into a standalone, eval-free validator module.
//
// browser extensions forbid eval / new Function via their Content Security Policy.
// Ajv normally compiles a schema at runtime by generating code and running it with
// new Function, which the extension blocks. generating the validator ahead of time
// produces plain JavaScript we can import like any other module — no eval needed.

import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { readFileSync, writeFileSync } from "node:fs";

// load the schemas (the rules) as plain objects, one per supported IIIF Presentation
// API version. add a new entry here (and a matching .schema.json) to support a version.
const schemaV3 = JSON.parse(
  readFileSync("iiif-presentation-3.schema.json", "utf8"),
);
const schemaV2 = JSON.parse(
  readFileSync("iiif-presentation-2.schema.json", "utf8"),
);

// allErrors: report every problem, not just the first.
// code.source: keep the generated code so it can be exported as standalone source.
const ajv = new Ajv({ allErrors: true, code: { source: true } });

// compile each schema (this is the step that uses eval — fine in Node) and register it
// under its $id, so standaloneCode below can look each one up by name.
ajv.compile(schemaV3);
ajv.compile(schemaV2);

// serialize both validators into one plain, eval-free JavaScript source, named exports
// matching the keys below (validateManifestV3, validateManifestV2).
const moduleSource = standaloneCode(ajv, {
  validateManifestV3: schemaV3.$id,
  validateManifestV2: schemaV2.$id,
});

// write it out; workbench.js imports this file. the length log is a quick sanity check.
console.log("Generated validator length:", moduleSource.length);
writeFileSync("manifest-validator.js", moduleSource);
console.log("Wrote manifest-validator.js");
