import { describe, expect, it } from "vitest";
import { scanTags, TagStream, type Tag } from "./xml";

const collect = (text: string): Tag[] => {
  const tags: Tag[] = [];
  scanTags(text, (t) => tags.push(t));
  return tags;
};

describe("scanTags", () => {
  it("reads names, decoded attributes, start, end and self-closing tags", () => {
    expect(collect('<a x="1&amp;2"/><b>t</b>')).toEqual([
      { name: "a", attrs: { x: "1&2" }, end: false, selfClosing: true },
      { name: "b", attrs: {}, end: false, selfClosing: false },
      { name: "b", attrs: {}, end: true, selfClosing: false },
    ]);
  });

  it("decodes every entity and keeps namespaced names as written", () => {
    expect(collect(`<c p:path='/3D/x.model' v="&lt;&gt;&quot;&apos;&#65;&#x42;"/>`)).toEqual([
      { name: "c", attrs: { "p:path": "/3D/x.model", v: `<>"'AB` }, end: false, selfClosing: true },
    ]);
  });

  it("skips the declaration, comments, CDATA and doctype", () => {
    expect(collect('<?xml version="1.0"?><!-- <x/> --><!DOCTYPE m><![CDATA[<y/>]]><m/>').map((t) => t.name)).toEqual(["m"]);
  });
});

describe("TagStream", () => {
  it("gives the same tags when the text is split anywhere", () => {
    const text = '<?xml version="1.0"?><model unit="inch"><!-- c --><item objectid="2" transform="1 0 0"/></model>';
    const whole = collect(text);
    for (let cut = 1; cut < text.length; cut++) {
      const tags: Tag[] = [];
      const s = new TagStream((t) => tags.push(t));
      s.push(text.slice(0, cut));
      s.push(text.slice(cut));
      s.end();
      expect(tags).toEqual(whole);
    }
  });

  it("gives the same tags from UTF-8 bytes split anywhere, multi-byte characters included", () => {
    const text = '<o name="Spülé €"/>text ü<p v="ß"/>';
    const bytes = new TextEncoder().encode(text);
    const whole = collect(text);
    for (let cut = 1; cut < bytes.length; cut++) {
      const tags: Tag[] = [];
      const s = new TagStream((t) => tags.push(t));
      s.pushBytes(bytes.subarray(0, cut));
      s.pushBytes(bytes.subarray(cut));
      s.end();
      expect(tags).toEqual(whole);
    }
  });

  it("keeps nothing of text between tags", () => {
    const tags: Tag[] = [];
    const s = new TagStream((t) => tags.push(t));
    for (let i = 0; i < 100; i++) s.push("\0".repeat(1 << 16));
    s.push("<a/>");
    s.end();
    expect(tags.map((t) => t.name)).toEqual(["a"]);
  });
});
