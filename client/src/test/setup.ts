// jsdom has no native modal-dialog implementation. Browsers use the native API.
if (typeof HTMLDialogElement !== "undefined") {
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
  this.querySelector<HTMLElement>("[autofocus], button, input, select")?.focus();
};
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };

}
