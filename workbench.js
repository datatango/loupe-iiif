// runs in workbench tab
const input = document.getElementById("input");
const report = document.getElementById("report");

document.getElementById("validate").addEventListener("click", () => {
  render(validate(input.value));
});

// validate button (layer 1)
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
  try {
    JSON.parse(text);
  } catch (err) {
    return [
      { severity: "error", layer: 1, message: "Invalid JSON: " + err.message },
    ];
  }
  return [
    { severity: "ok", layer: 1, message: "Layer 1 passed - well-formed JSON." },
  ];
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
