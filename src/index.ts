import Editor from "./view/editor";

const alice = document.getElementById("alice");
if (alice instanceof HTMLDivElement) {
	new Editor(alice);
}

const bob = document.getElementById("bob");
if (bob instanceof HTMLDivElement) {
	new Editor(bob);
}
