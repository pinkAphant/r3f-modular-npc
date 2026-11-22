import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

export interface TempFixtures {
  dir: string;
  validPngPath: string;
  redPngPath: string;
  invalidTxtPath: string;
  emptyGlbPath: string;
  corruptGlbPath: string;
  validMultiMeshGlbPath: string;
  largeValidGlbPath: string;
  cleanup: () => void;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.byteLength; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.byteLength, 0);
  const tag = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([len, tag, data, crcBuf]);
}

export function buildPngBuffer(width: number, height: number, solidRed = false): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    rows[row] = 0;
    for (let x = 0; x < width; x++) {
      const p = row + 1 + x * 4;
      const even = ((x >> 2) + (y >> 2)) % 2 === 0;
      rows[p] = solidRed || even ? 255 : 20;
      rows[p + 1] = solidRed ? 0 : even ? 40 : 230;
      rows[p + 2] = solidRed ? 0 : even ? 40 : 90;
      rows[p + 3] = 255;
    }
  }
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    magic,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pad4(buf: Buffer, fillByte: number): Buffer {
  const rem = buf.byteLength % 4;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, fillByte)]);
}

export function buildMultiMeshGlb(scale = 1): Buffer {
  const s = scale;
  const posA = new Float32Array([-0.2 * s, 0, 0, 0.2 * s, 0, 0, 0, 0.4 * s, 0]);
  const posB = new Float32Array([-0.2 * s, 0.4 * s, 0.05 * s, 0.2 * s, 0.4 * s, 0.05 * s, 0, 0.8 * s, 0.05 * s]);
  const norm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uv = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  const parts = [
    Buffer.from(posA.buffer),
    Buffer.from(posB.buffer),
    Buffer.from(norm.buffer),
    Buffer.from(uv.buffer),
  ];
  let offset = 0;
  const bufferViews = parts.map((p) => {
    const bv = { buffer: 0, byteOffset: offset, byteLength: p.byteLength };
    offset += p.byteLength;
    return bv;
  });
  const binRaw = Buffer.concat(parts);
  const binChunkData = pad4(binRaw, 0x00);
  const gltf = {
    asset: { version: '2.0', generator: 'r3f-modular-npc-e2e-fixture' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: 'Segment_A', mesh: 0 },
      { name: 'Segment_B', mesh: 1 },
    ],
    meshes: [
      { name: 'Mesh_Body', primitives: [{ attributes: { POSITION: 0, NORMAL: 2, TEXCOORD_0: 3 } }] },
      { name: 'Mesh_Cap', primitives: [{ attributes: { POSITION: 1, NORMAL: 2, TEXCOORD_0: 3 } }] },
    ],
    buffers: [{ byteLength: binRaw.byteLength }],
    bufferViews,
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.2 * s, 0, 0], max: [0.2 * s, 0.4 * s, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3', min: [-0.2 * s, 0.4 * s, 0.05 * s], max: [0.2 * s, 0.8 * s, 0.05 * s] },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 3, componentType: 5126, count: 3, type: 'VEC2' },
    ],
  };
  const jsonChunkData = pad4(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20);
  const totalLen = 12 + 8 + jsonChunkData.byteLength + 8 + binChunkData.byteLength;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);
  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonChunkData.byteLength, 0);
  jsonHdr.writeUInt32LE(0x4e4f534a, 4);
  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(binChunkData.byteLength, 0);
  binHdr.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHdr, jsonChunkData, binHdr, binChunkData]);
}

export function createTempFixtures(): TempFixtures {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r3f-e2e-'));
  const validPngPath = path.join(dir, 'checker.png');
  const redPngPath = path.join(dir, 'pure_red.png');
  const invalidTxtPath = path.join(dir, 'not_valid.txt');
  const emptyGlbPath = path.join(dir, 'empty.glb');
  const corruptGlbPath = path.join(dir, 'corrupt.glb');
  const validMultiMeshGlbPath = path.join(dir, 'multi_mesh_prop.glb');
  const largeValidGlbPath = path.join(dir, 'huge_prop.glb');

  fs.writeFileSync(validPngPath, buildPngBuffer(32, 32, false));
  fs.writeFileSync(redPngPath, buildPngBuffer(32, 32, true));
  fs.writeFileSync(invalidTxtPath, 'invalid payload for negative upload test');
  fs.writeFileSync(emptyGlbPath, Buffer.alloc(0));
  fs.writeFileSync(corruptGlbPath, Buffer.from('BAD!truncated_glb_json_chunk', 'utf8'));
  fs.writeFileSync(validMultiMeshGlbPath, buildMultiMeshGlb(1));
  fs.writeFileSync(largeValidGlbPath, buildMultiMeshGlb(50));

  return {
    dir,
    validPngPath,
    redPngPath,
    invalidTxtPath,
    emptyGlbPath,
    corruptGlbPath,
    validMultiMeshGlbPath,
    largeValidGlbPath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
