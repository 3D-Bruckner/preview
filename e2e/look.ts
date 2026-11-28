// The 3D view judged by its pixels, taken from a screenshot of it (a WebGL canvas can't be read back after it has been shown). Headless
// Chromium draws WebGL in software. Shared by the viewer's and the review page's tests.
import { expect, type Locator, type Page } from "@playwright/test";

/** The view, once it has drawn the model. */
export async function openView(page: Page, path: string, title: string): Promise<Locator> {
  await page.goto(path);
  const view = page.getByRole("img", { name: `3D-Ansicht von ${title}` });
  await expect(view).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  return view;
}

export type Rgb = [number, number, number];
export interface Look {
  /** The colour behind the model: the middle of the top edge, which the model never reaches. */
  background: Rgb;
  centre: Rgb;
  /** How many pixels are clearly red, and clearly blue. */
  red: number;
  blue: number;
  /** The view shrunk to 24×24 grey values: two looks are the same view when these are (nearly) equal. */
  thumb: number[];
}

/** What the view shows now, from a screenshot of it, read in the page. */
export async function look(page: Page, view: Locator): Promise<Look> {
  // The model only: the tools over the view are text and lines whose anti-aliasing differs between machines.
  const png = (await view.screenshot({ style: "[data-view-tools] { visibility: hidden }" })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const at = (x: number, y: number): [number, number, number] => {
      const d = g.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };
    const all = g.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let blue = 0;
    for (let i = 0; i < all.length; i += 4) {
      const [r, gr, b] = [all[i]!, all[i + 1]!, all[i + 2]!];
      if (r > gr + 60 && r > b + 60) red++;
      if (b > r + 60 && b > gr + 30) blue++;
    }
    const thumb: number[] = [];
    const s = document.createElement("canvas");
    s.width = s.height = 24;
    const sg = s.getContext("2d", { willReadFrequently: true })!;
    sg.drawImage(c, 0, 0, 24, 24);
    const sd = sg.getImageData(0, 0, 24, 24).data;
    for (let i = 0; i < sd.length; i += 4) thumb.push(Math.round((sd[i]! + sd[i + 1]! + sd[i + 2]!) / 3));
    return { background: at(c.width / 2, 6), centre: at(c.width / 2, c.height / 2), red, blue, thumb };
  }, png);
}

export const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The mean difference of two looks' thumbnails, in grey levels. */
export const apart = (a: Look, b: Look) => a.thumb.reduce((sum, v, i) => sum + Math.abs(v - b.thumb[i]!), 0) / a.thumb.length;
/** Software WebGL draws slowly while the other workers run: a view that moves gets longer than the default to get there. */
export const MOVING = { timeout: 20_000 };
