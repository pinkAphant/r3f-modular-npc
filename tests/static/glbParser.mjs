const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMP_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const COMP_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

export function parseGlb(buf) {
  if (!Buffer.isBuffer(buf) || buf.byteLength < 12) {
    throw new Error('Invalid GLB: buffer shorter than 12-byte header');
  }
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const totalLen = buf.readUInt32LE(8);
  if (magic !== GLB_MAGIC) {
    throw new Error(`Invalid GLB magic: 0x${magic.toString(16)}`);
  }
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }
  if (totalLen !== buf.byteLength) {
    throw new Error(`GLB length mismatch: header=${totalLen} actual=${buf.byteLength}`);
  }
  let offset = 12;
  let gltf = null;
  let bin = Buffer.alloc(0);
  while (offset < totalLen) {
    if (offset + 8 > totalLen) {
      throw new Error(`Truncated GLB chunk header at offset ${offset}`);
    }
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (len % 4 !== 0 || dataOffset + len > totalLen) {
      throw new Error(`Malformed GLB chunk at offset ${offset}: len=${len}`);
    }
    const slice = buf.subarray(dataOffset, dataOffset + len);
    if (type === CHUNK_JSON && gltf === null) {
      gltf = JSON.parse(slice.toString('utf8'));
    } else if (type === CHUNK_BIN && bin.byteLength === 0) {
      bin = slice;
    }
    offset = dataOffset + len;
  }
  if (!gltf) throw new Error('GLB missing JSON chunk');
  return { gltf, bin };
}

function readComponent(view, bytePos, compType, normalized) {
  let val = 0;
  if (compType === 5120) val = view.getInt8(bytePos);
  else if (compType === 5121) val = view.getUint8(bytePos);
  else if (compType === 5122) val = view.getInt16(bytePos, true);
  else if (compType === 5123) val = view.getUint16(bytePos, true);
  else if (compType === 5125) val = view.getUint32(bytePos, true);
  else if (compType === 5126) return view.getFloat32(bytePos, true);
  else throw new Error(`Unsupported componentType ${compType}`);
  if (!normalized) return val;
  if (compType === 5121) return val / 255;
  if (compType === 5123) return val / 65535;
  if (compType === 5120) return Math.max(val / 127, -1);
  if (compType === 5122) return Math.max(val / 32767, -1);
  return val;
}

export function readAccessor(gltf, bin, accessorIdx) {
  const acc = gltf.accessors?.[accessorIdx];
  if (!acc) throw new Error(`Missing accessor ${accessorIdx}`);
  const numComp = COMP_COUNT[acc.type];
  const elemBytes = COMP_BYTES[acc.componentType];
  if (!numComp || !elemBytes) {
    throw new Error(`Unsupported accessor format: ${acc.type}/${acc.componentType}`);
  }
  const bv = gltf.bufferViews?.[acc.bufferView];
  if (!bv) throw new Error(`Accessor ${accessorIdx} missing bufferView`);
  const baseOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = bv.byteStride || numComp * elemBytes;
  const neededEnd = baseOffset + (acc.count > 0 ? (acc.count - 1) * stride + numComp * elemBytes : 0);
  if (neededEnd > bin.byteLength) {
    throw new Error(`Accessor ${accessorIdx} exceeds BIN bounds (${neededEnd} > ${bin.byteLength})`);
  }
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float64Array(acc.count * numComp);
  const norm = Boolean(acc.normalized);
  for (let i = 0; i < acc.count; i++) {
    const row = baseOffset + i * stride;
    for (let c = 0; c < numComp; c++) {
      out[i * numComp + c] = readComponent(view, row + c * elemBytes, acc.componentType, norm);
    }
  }
  return { values: out, numComp, count: acc.count };
}

export function validateEmbeddedImages(gltf, bin) {
  const images = gltf.images ?? [];
  if (images.length === 0) {
    throw new Error('No embedded images found in GLB');
  }
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.mimeType !== 'image/jpeg' && img.mimeType !== 'image/png') {
      throw new Error(`Image[${i}] unsupported mimeType: ${img.mimeType}`);
    }
    const bv = gltf.bufferViews?.[img.bufferView];
    if (!bv) throw new Error(`Image[${i}] missing bufferView`);
    const start = bv.byteOffset ?? 0;
    const end = start + bv.byteLength;
    if (end > bin.byteLength || bv.byteLength < 8) {
      throw new Error(`Image[${i}] bufferView out of bounds`);
    }
    const slice = bin.subarray(start, end);
    if (img.mimeType === 'image/jpeg') {
      if (slice[0] !== 0xff || slice[1] !== 0xd8 || slice[2] !== 0xff) {
        throw new Error(`Image[${i}] invalid JPEG magic bytes`);
      }
    } else if (!pngMagic.every((b, idx) => slice[idx] === b)) {
      throw new Error(`Image[${i}] invalid PNG magic bytes`);
    }
  }
  return images.length;
}

export function countNonFinite(values) {
  let bad = 0;
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) bad++;
  }
  return bad;
}
