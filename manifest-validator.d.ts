// hand-written types for the generated validator (manifest-validator.js).
//
// scripts/build-validator.js precompiles the IIIF schema with Ajv and writes
// manifest-validator.js as plain, eval-free JavaScript — with no type information.
// this declaration tells TypeScript the shape workbench.ts relies on. it sits next
// to the generated .js file, so TypeScript uses it as that module's types.
//
// the export shape (a boolean-returning function that hangs its problems off an
// `errors` property) is Ajv's stable standalone contract, so this file is
// hand-maintained and committed even though the .js it describes is generated.

// one problem Ajv found, trimmed to the fields the workbench actually reads.
export interface ValidationError {
  // JSON Pointer to the offending value, e.g. "/items/0/type" ("" means the root).
  instancePath: string;
  // JSON Pointer into the schema that failed, e.g. "#/definitions/canvas/anyOf/0/required".
  schemaPath: string;
  // the failed schema keyword, e.g. "required", "type", "anyOf".
  keyword: string;
  // keyword-specific details; only missingProperty (from "required") is used here.
  params?: { missingProperty?: string };
  message?: string;
}

// returns true when the data matches the schema; otherwise false, and the problems
// are left on `errors` until the next call.
export interface ValidateManifestStructure {
  (data: unknown): boolean;
  errors?: ValidationError[] | null;
}

declare const validateManifestStructure: ValidateManifestStructure;
export default validateManifestStructure;
