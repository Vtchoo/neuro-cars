/** Small DOM adapter shared by both renderers; menus never depend on a canvas library. */
export class MenuElement {
  readonly elt: HTMLElement;
  constructor(tag: string, text = "") {
    this.elt = document.createElement(tag);
    this.elt.textContent = text;
    document.body.append(this.elt);
  }
  style(value: string, content?: string) {
    if (content === undefined) this.elt.style.cssText = value;
    else this.elt.style.setProperty(value, content);
    return this;
  }
  html(): string;
  html(value: string): this;
  html(value?: string) {
    if (value === undefined) return this.elt.innerHTML;
    this.elt.textContent = value;
    return this;
  }
  parent(parent: MenuElement) {
    parent.elt.append(this.elt);
    return this;
  }
  child(child: MenuElement) {
    this.elt.append(child.elt);
    return this;
  }
  attribute(name: string, value: string) {
    this.elt.setAttribute(name, value);
    return this;
  }
  mouseClicked(callback: () => void) {
    this.elt.addEventListener("click", callback);
    return this;
  }
  remove() {
    this.elt.remove();
  }
}

export const dom = {
  createElement: (tag: string, text = "") => new MenuElement(tag, text),
  createButton: (text: string) => new MenuElement("button", text),
  createDiv: (text = "") => new MenuElement("div", text),
};
