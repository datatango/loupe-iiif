// entry point for the workbench tab: mount the Svelte app onto the page.
// workbench.html now contains almost nothing but the <div id="app"> target below.
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (target === null) {
  throw new Error('expected an element with id "app"');
}

mount(App, { target });
