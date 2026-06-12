// precompiles the IIIF schema into a standalone, eval-free validator module.
//
// browser extensions forbid eval / new Function via their Content Security Policy.
// Ajv normally compiles a schema at runtime by generating code and running it with
// new Function, which the extension blocks. generating the validator ahead of time
// produces plain JavaScript we can import like any other module — no eval needed.

import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { readFileSync, writeFileSync } from "node:fs";

// load the schema (the rules) as a plain object.
const schema = JSON.parse(
  readFileSync("iiif-presentation-3.schema.json", "utf8"),
);

// allErrors: report every problem, not just the first.
// code.source: keep the generated code so it can be exported as standalone source.
const ajv = new Ajv({ allErrors: true, code: { source: true } });

// compile the schema into a validator (this is the step that uses eval — fine in Node).
const validate = ajv.compile(schema);

// serialize that validator into plain, eval-free JavaScript source.
const moduleSource = standaloneCode(ajv, validate);

// write it out; workbench.js imports this file. the length log is a quick sanity check.
console.log("Generated validator length:", moduleSource.length);
writeFileSync("manifest-validator.js", moduleSource);
console.log("Wrote manifest-validator.js");
