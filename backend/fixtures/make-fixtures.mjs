// Makes the files backend/files.test.ts and the viewer's tests use, tiny and made here so the repository holds nothing but what it generates.
// Run once, and the result is committed: node backend/fixtures/make-fixtures.mjs
//
// - ramp.3mf: a valid 3MF with one object, a box (8 vertices, 12 triangles), no colour.
// - keychain.3mf: a valid 3MF with two objects, each a box, one red and one blue through basematerials' displaycolor.
// - preview.png: a valid 8×8 PNG.
// - not-a-3mf.3mf: a zip that has no 3D/3dmodel.model.
// - plates.3mf: a Bambu Studio-style project with 2 plates. Root objects 2 "Halter" (one component, object 1: a 20 mm box in
//   3D/Objects/object_1.model) and 4 "Spule" (components 3, 5, 7 of 3D/Objects/object_2.model: 10 mm boxes at x 0, 12 and 24; ids unique
//   across the files, as Bambu Studio writes them), build items 2 at x 0 and 4 at x 300; Metadata/model_settings.config: Spule's part 3 on
//   extruder 2, part 5 on the object's extruder 1, part 7 a modifier; Metadata/project_settings.config (JSON): slots #00AE42 PLA and
//   #FFFFFFFF PETG; Metadata/plate_1.png and plate_2.png (the preview.png below).
// - showcase.3mf: the README's screenshot, a Bambu-style desk organiser laid out close together: Ablage (a 90 × 60 × 5 tray, black),
//   Stiftehalter (24 × 24 × 45, green), Kartenhalter (40 × 12 × 28, white) and Clip (16 × 10 × 8, green); slots black, green, white PLA.
import { readFileSync, writeFileSync } from "node:fs";
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
  return cuboid(x0, 0, 0, size, size, size);
}

/** A box of w × d × h mm with its corner at (x0, y0, z0). */
function cuboid(x0, y0, z0, w, d, h) {
  const v = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ].map(([x, y, z]) => `<vertex x="${x0 + x * w}" y="${y0 + y * d}" z="${z0 + z * h}"/>`);
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

const meshObject = (id, x0, size) => {
  const m = box(x0, size);
  return `<object id="${id}" type="model"><mesh><vertices>${m.vertices}</vertices><triangles>${m.triangles}</triangles></mesh></object>`;
};
const subModel = (objects) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${objects}</resources><build/></model>`;
const component = (path, id) => `<component p:path="${path}" objectid="${id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`;
const platesRoot = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"><resources><object id="2" type="model"><components>${component("/3D/Objects/object_1.model", 1)}</components></object><object id="4" type="model"><components>${[3, 5, 7].map((i) => component("/3D/Objects/object_2.model", i)).join("")}</components></object></resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/><item objectid="4" transform="1 0 0 0 1 0 0 0 1 300 0 0" printable="1"/></build></model>`;
const meta = (key, value) => `<metadata key="${key}" value="${value}"/>`;
const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">${meta("name", "Halter")}${meta("extruder", "1")}<part id="1" subtype="normal_part">${meta("name", "Halter")}</part></object>
  <object id="4">${meta("name", "Spule")}${meta("extruder", "1")}<part id="3" subtype="normal_part">${meta("name", "Rand")}${meta("extruder", "2")}</part><part id="5" subtype="normal_part">${meta("name", "Kern")}</part><part id="7" subtype="modifier_part">${meta("name", "Modifier")}${meta("extruder", "2")}</part></object>
  <plate>${meta("plater_id", "1")}${meta("plater_name", "Halter")}${meta("thumbnail_file", "Metadata/plate_1.png")}<model_instance>${meta("object_id", "2")}${meta("instance_id", "0")}</model_instance></plate>
  <plate>${meta("plater_id", "2")}${meta("plater_name", "")}<model_instance>${meta("object_id", "4")}${meta("instance_id", "0")}</model_instance></plate>
</config>`;
const projectSettings = JSON.stringify({ filament_colour: ["#00AE42", "#FFFFFFFF"], filament_type: ["PLA", "PETG"] }, null, 4);

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

const png = readFileSync(out("preview.png"));
writeFileSync(
  out("plates.3mf"),
  zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "3D/3dmodel.model": strToU8(platesRoot),
    "3D/Objects/object_1.model": strToU8(subModel(meshObject(1, 0, 20))),
    "3D/Objects/object_2.model": strToU8(subModel(meshObject(3, 0, 10) + meshObject(5, 12, 10) + meshObject(7, 24, 10))),
    "Metadata/model_settings.config": strToU8(modelSettings),
    "Metadata/project_settings.config": strToU8(projectSettings),
    "Metadata/plate_1.png": png,
    "Metadata/plate_2.png": png,
  }),
);

const showcaseObjects = [
  [1, "Ablage", 1, [0, 0, 0, 90, 60, 5]],
  [2, "Stiftehalter", 2, [98, 0, 0, 24, 24, 45]],
  [3, "Kartenhalter", 3, [98, 32, 0, 40, 12, 28]],
  [4, "Clip", 2, [128, 0, 0, 16, 10, 8]],
];
const showcaseRoot = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${showcaseObjects
  .map(([id, , , dims]) => {
    const m = cuboid(...dims);
    return `<object id="${id}" type="model"><mesh><vertices>${m.vertices}</vertices><triangles>${m.triangles}</triangles></mesh></object>`;
  })
  .join("")}</resources><build>${showcaseObjects.map(([id]) => `<item objectid="${id}" printable="1"/>`).join("")}</build></model>`;
const showcaseSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${showcaseObjects.map(([id, name, extruder]) => `  <object id="${id}">${meta("name", name)}${meta("extruder", String(extruder))}</object>`).join("\n")}
</config>`;
writeFileSync(
  out("showcase.3mf"),
  zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "3D/3dmodel.model": strToU8(showcaseRoot),
    "Metadata/model_settings.config": strToU8(showcaseSettings),
    "Metadata/project_settings.config": strToU8(
      JSON.stringify({ filament_colour: ["#1D1E21", "#00AE42", "#F7F7F5"], filament_type: ["PLA", "PLA", "PLA"] }, null, 4),
    ),
  }),
);
