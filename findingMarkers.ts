// CodeMirror plumbing that flags the source ranges a validation run points to, both as
// inline underlines and as dots in a margin gutter. the ranges themselves are computed in
// App.svelte (each finding's JSON Pointer mapped to an offset via jsonc-parser); this
// module only holds and renders them, all driven by one setMarkers effect.
import { RangeSet, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  type DecorationSet,
} from "@codemirror/view";

// a character range in the document to flag.
export type MarkerRange = {
  from: number;
  to: number;
};

// effect that carries a fresh set of ranges into the editor state. dispatching it
// replaces whatever markers were showing before (so re-validating clears stale ones).
export const setMarkers = StateEffect.define<MarkerRange[]>();

// keep only ranges that actually cover some text.
function nonEmptyRanges(ranges: readonly MarkerRange[]): MarkerRange[] {
  return ranges.filter((range) => range.to > range.from);
}

// --- inline underline decorations ---

const errorMark = Decoration.mark({ class: "cm-finding-error" });

const underlineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    // shift existing marks so they stay aligned as the user edits around them.
    decorations = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setMarkers)) {
        const marks = nonEmptyRanges(effect.value).map((range) =>
          errorMark.range(range.from, range.to),
        );
        // second argument sorts the marks, which Decoration.set requires.
        decorations = Decoration.set(marks, true);
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// --- margin gutter dots ---

class ErrorGutterMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-finding-gutter-dot";
    dot.textContent = "●"; // ● filled circle
    return dot;
  }
}

const errorGutterMarker = new ErrorGutterMarker();

const gutterField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(markers, transaction) {
    markers = markers.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setMarkers)) {
        const doc = transaction.state.doc;
        // one dot per affected line, even if several errors share that line.
        const seenLineStarts = new Set<number>();
        const gutterMarks = [];
        for (const range of nonEmptyRanges(effect.value)) {
          const lineStart = doc.lineAt(range.from).from;
          if (seenLineStarts.has(lineStart)) {
            continue;
          }
          seenLineStarts.add(lineStart);
          gutterMarks.push(errorGutterMarker.range(lineStart));
        }
        markers = RangeSet.of(gutterMarks, true);
      }
    }
    return markers;
  },
});

const errorGutter = gutter({
  class: "cm-finding-gutter",
  markers: (view) => view.state.field(gutterField),
});

// --- shared theme ---

const markerTheme = EditorView.baseTheme({
  ".cm-finding-error": {
    textDecoration: "underline wavy var(--iiif-red)",
  },
  ".cm-finding-gutter": {
    width: "1.2em",
  },
  ".cm-finding-gutter-dot": {
    display: "block",
    textAlign: "center",
    color: "var(--iiif-red)",
  },
});

export function findingMarkers(): Extension {
  return [underlineField, gutterField, errorGutter, markerTheme];
}
