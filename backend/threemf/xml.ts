// An XML tag scanner that reads only tags and their attributes: what preview needs from a 3MF's model and Bambu's configs. Text between
// tags is dropped as it is read, so a stream of any size is scanned in the memory of its largest tag. Not a validating parser: it trusts
// the file to be well formed and skips what it cannot read.

export type Tag = { name: string; attrs: Record<string, string>; end: boolean; selfClosing: boolean };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}

const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** One tag's inside, between `<` and `>`. */
function parseTag(inner: string): Tag | null {
  const end = inner.startsWith("/");
  const body = end ? inner.slice(1) : inner;
  const selfClosing = !end && body.endsWith("/");
  const name = /^[^\s/>]+/.exec(body)?.[0];
  if (!name) return null;
  const attrs: Record<string, string> = {};
  if (!end) for (const m of body.slice(name.length).matchAll(ATTR)) attrs[m[1]!] = decode(m[2] ?? m[3] ?? "");
  return { name, attrs, end, selfClosing };
}

/** Feeds text in pieces; a tag split between pieces is joined before it is read. */
export class TagStream {
  private rest = "";
  private decoder = new TextDecoder();
  constructor(private readonly onTag: (t: Tag) => void) {}

  /** UTF-8 bytes; a piece with no "<" while no tag is open is text and dropped undecoded (a bomb of zeros costs only the inflating). */
  pushBytes(bytes: Uint8Array): void {
    if (!this.rest && bytes.indexOf(0x3c) < 0) {
      this.decoder = new TextDecoder();
      return;
    }
    this.push(this.decoder.decode(bytes, { stream: true }));
  }

  push(chunk: string): void {
    let text = this.rest + chunk;
    let at = 0;
    for (;;) {
      const open = text.indexOf("<", at);
      if (open < 0) {
        this.rest = "";
        return;
      }
      // The constructs that are no tag end with their own marker, which may hold a ">".
      let close: number;
      let skip = false;
      if (text.startsWith("<!--", open)) [close, skip] = [text.indexOf("-->", open + 4), true];
      else if (text.startsWith("<![CDATA[", open)) [close, skip] = [text.indexOf("]]>", open + 9), true];
      else if (text.length - open < 9 && ("<!--".startsWith(text.slice(open)) || "<![CDATA[".startsWith(text.slice(open)))) close = -1;
      else close = text.indexOf(">", open + 1);
      if (close < 0) {
        this.rest = text.slice(open);
        return;
      }
      const end = skip ? close + 3 : close + 1;
      if (!skip) {
        const inner = text.slice(open + 1, close);
        if (!inner.startsWith("?") && !inner.startsWith("!")) {
          const tag = parseTag(inner);
          if (tag) this.onTag(tag);
        }
      }
      at = end;
      if (at > 1 << 16) {
        text = text.slice(at);
        at = 0;
      }
    }
  }

  end(): void {
    this.push(this.decoder.decode());
    this.rest = "";
  }
}

/** Every tag of a whole text, in order. */
export function scanTags(text: string, onTag: (t: Tag) => void): void {
  const s = new TagStream(onTag);
  s.push(text);
  s.end();
}
