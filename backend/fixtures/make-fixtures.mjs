// Makes the files backend/files.test.ts and the viewer's tests use, tiny and made here so the repository holds nothing but what it generates.
// Run once, and the result is committed: node backend/fixtures/make-fixtures.mjs
//
// - ramp.3mf: a valid 3MF with one object, a box (8 vertices, 12 triangles), no colour.
// - keychain.3mf: a valid 3MF with two objects, each a box, one red and one blue through basematerials' displaycolor.
// - preview.png: a valid 8×8 PNG.
// - not-a-3mf.3mf: a zip that has no 3D/3dmodel.model.
import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const out = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

/** A box of the given size at x0 as a mesh: 8 vertices, 12 triangles. */
function box(x0, size) {
  const v = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ].map(([x, y, z]) => `<vertex x="${x0 + x * size}" y="${y * size}" z="${z * size}"/>`);
  const t = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  return { vertices: v.join(""), triangles: t.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join("") };
}

function model(objects, resources = "") {
  const objs = objects
    .map(({ id, x0, size, pid }) => {
      const m = box(x0, size);
      return `<object id="${id}" type="model"${pid ? ` pid="${pid}" pindex="0"` : ""}><mesh><vertices>${m.vertices}</vertices><triangles>${m.triangles}</triangles></mesh></object>`;
    })
    .join("");
  const items = objects.map(({ id }) => `<item objectid="${id}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${resources}${objs}</resources><build>${items}</build></model>`;
}

const threemf = (modelXml) => zipSync({ "[Content_Types].xml": strToU8(CONTENT_TYPES), "_rels/.rels": strToU8(RELS), "3D/3dmodel.model": strToU8(modelXml) });

writeFileSync(out("ramp.3mf"), threemf(model([{ id: 1, x0: 0, size: 20 }])));

const colours = `<basematerials id="10"><base name="red" displaycolor="#D62828FF"/></basematerials><basematerials id="11"><base name="blue" displaycolor="#1D4ED8FF"/></basematerials>`;
writeFileSync(
  out("keychain.3mf"),
  threemf(
    model(
      [
        { id: 1, x0: 0, size: 20, pid: 10 },
        { id: 2, x0: 25, size: 10, pid: 11 },
      ],
      colours,
    ),
  ),
);

writeFileSync(out("not-a-3mf.3mf"), zipSync({ "readme.txt": strToU8("a zip, but no model in it") }));

/** One PNG chunk: length, type, data, CRC. */
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(8, 0);
ihdr.writeUInt32BE(8, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(8 * 3, 0x80)]);
writeFileSync(
  out("preview.png"),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: 8 }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
