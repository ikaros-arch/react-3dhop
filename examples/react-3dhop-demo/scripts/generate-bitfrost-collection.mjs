// Converts a curated subset of the BITTFROST catalogue export (examples/bitfrost_list.json) into a
// IIIF 3D Collection + Manifests, so the demo has a realistic multi-object dataset to browse.
//
// Run with: node examples/react-3dhop-demo/scripts/generate-bitfrost-collection.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SOURCE_LIST = join(REPO_ROOT, 'examples', 'bitfrost_list.json');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'manifests', 'bitfrost');

// Resolved against these bases per the BITTFROST catalogue's own layout, not the manifest's own id.
const DATA_BASE = 'https://3d.unimus.no/bitfrost/';
const IMAGE_BASE = 'https://3d.unimus.no/images/';

/** A hand-picked spread of single- and multi-model groups, both measure units, with and without a TRANSFORM. */
const SELECTED_KEYS = [
  'f9d83cf6-8394-447c-8eb8-fc3f0cb2229a', // C55000/152 h — mm, single model
  'f6d9b2bb-7afc-4a88-b099-2b2825e2ac67', // UEM2444 — m, single model, TRANSFORM
  'eef19846-6475-49ae-baea-ecdacde8e135', // C55000/499.2 — mm, single model
  'bf4c9866-3fc1-4f75-8cb6-0e2745039bd5', // C22007 — m, single model
  'b82803b2-659e-4821-ac3a-db0a8cac0853', // C41792 — m, single model, TRANSFORM
  'ac13b546-7ac6-4892-ad4c-4613afe424a3', // C55000/192 a — mm, single model, TRANSFORM
  '690dd2be-e18f-457c-8c50-0acf8cdfe6c8', // C33448_G06098 — mm, single model, TRANSFORM
  'a0765680-e2c9-4436-b5b2-58b910781e1b', // C10468 — m, five-model group, TRANSFORM
  '5545e30d-4e5e-47b0-841a-a8b3d640cd77', // Kviljo — two-model group
  '99b583ee-349c-49e3-8891-07c1e34f495a' // C55000/47 — three-model group
];

function stripHtml(value) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : value;
}

function parseTransform(raw) {
  if (!raw) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const transforms = [];
  if (Array.isArray(parsed.rotation) && parsed.rotation.some((v) => v !== 0)) {
    const [x, y, z] = parsed.rotation;
    transforms.push({ type: 'RotateTransform', x, y, z });
  }
  if (Array.isArray(parsed.translation) && parsed.translation.some((v) => v !== 0)) {
    const [x, y, z] = parsed.translation;
    transforms.push({ type: 'TranslateTransform', x, y, z });
  }
  return transforms;
}

function metadataField(label, value) {
  return value ? { label: { en: [label] }, value: { en: [String(value)] } } : undefined;
}

function buildManifest(uuid, entry) {
  const dataLocation = new URL(entry.DATA_LOCATION, DATA_BASE).toString();
  const objectIds = Array.isArray(entry['3D_OBJECT_ID']) ? entry['3D_OBJECT_ID'] : [entry['3D_OBJECT_ID']];
  const transforms = parseTransform(entry.TRANSFORM);
  const measureUnit = entry.MEASURE_UNIT || 'mm';

  const manifestId = `/manifests/bitfrost/${uuid}.json`;
  const sceneId = `${manifestId}/scene/1`;

  const items = objectIds.map((objectId, index) => {
    const modelUrl = new URL(`models/${objectId}.nxz`, dataLocation).toString();
    const annotationId = `${manifestId}/anno/${index}`;
    // Multi-model groups are spread out along X so they don't all render on top of one another.
    const position = objectIds.length > 1 ? { x: index * (measureUnit === 'm' ? 1.5 : 300), y: 0, z: 0 } : undefined;

    return {
      id: annotationId,
      type: 'Annotation',
      motivation: ['painting'],
      label: { en: [objectIds.length > 1 ? objectId : entry.title || objectId] },
      body:
        transforms.length > 0
          ? {
              type: 'SpecificResource',
              source: [{ id: modelUrl, type: 'Model', format: 'Nexus' }],
              transform: transforms
            }
          : { id: modelUrl, type: 'Model', format: 'Nexus' },
      target: {
        type: 'SpecificResource',
        source: [{ id: sceneId, type: 'Scene' }],
        ...(position ? { selector: [{ type: 'PointSelector', ...position }] } : {})
      }
    };
  });

  const metadata = [
    metadataField('Museum', entry.MUSEUM),
    metadataField('Inventory Number', entry.INVENTORY),
    metadataField('Object ID', objectIds.join(', ')),
    metadataField('Measure Unit', measureUnit),
    metadataField('Display Unit', entry.display_unit || measureUnit),
    metadataField('Acquisition Method', entry.ACQUISITION_METHOD),
    metadataField('Material', entry.MATERIAL1),
    metadataField('Category', entry.CATEGORY1),
    metadataField('Author', entry['3D_AUTHOR']),
    metadataField('Date', entry.DATE)
  ].filter(Boolean);

  const manifest = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: manifestId,
    type: 'Manifest',
    label: { en: [entry.title || uuid] },
    ...(entry.DESCRIPTION ? { summary: { en: [stripHtml(entry.DESCRIPTION)] } } : {}),
    metadata,
    requiredStatement: {
      label: { en: ['Attribution'] },
      value: { en: [entry.copyright_notice || 'Kulturhistorisk museum, Universitetet i Oslo'] }
    },
    items: [
      {
        id: sceneId,
        type: 'Scene',
        label: { en: [entry.title || uuid] },
        items: [{ id: `${manifestId}/page/1`, type: 'AnnotationPage', items }]
      }
    ]
  };

  return { manifestId, manifest };
}

function buildCollectionItem(uuid, entry, manifestId) {
  const thumbnail = entry.THUMBNAIL ? new URL(entry.THUMBNAIL, IMAGE_BASE).toString() : undefined;
  return {
    id: manifestId,
    type: 'Manifest',
    label: { en: [entry.title || uuid] },
    ...(thumbnail ? { thumbnail: [{ id: thumbnail, type: 'Image' }] } : {})
  };
}

async function main() {
  const source = JSON.parse(await readFile(SOURCE_LIST, 'utf-8'));
  await mkdir(OUTPUT_DIR, { recursive: true });

  const collectionItems = [];

  for (const uuid of SELECTED_KEYS) {
    const entry = source[uuid];
    if (!entry) {
      throw new Error(`bitfrost_list.json has no entry for ${uuid}`);
    }

    const { manifestId, manifest } = buildManifest(uuid, entry);
    await writeFile(join(OUTPUT_DIR, `${uuid}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    collectionItems.push(buildCollectionItem(uuid, entry, manifestId));
  }

  const collection = {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: '/manifests/bitfrost/collection.json',
    type: 'Collection',
    label: { en: ['BITTFROST sample objects'] },
    summary: {
      en: [
        'A curated subset of the Museum of Cultural History BITTFROST catalogue, for exercising the collection picker and carousel.'
      ]
    },
    items: collectionItems
  };

  await writeFile(join(OUTPUT_DIR, 'collection.json'), `${JSON.stringify(collection, null, 2)}\n`);

  console.log(`Wrote ${collectionItems.length} manifests and collection.json to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
