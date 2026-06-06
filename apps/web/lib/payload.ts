// Keepra payload envelope — wraps the user's text + files into one blob that is
// encrypted as a unit, then reconstructed after decryption.
//
//   [ MAGIC "KEEP" (4) | version (1) | manifestLen u32-LE (4) | manifest JSON | body ]
//
// Pure functions — no network, no crypto, fully unit-tested.

export const PAYLOAD_MAGIC = [0x4b, 0x45, 0x45, 0x50] as const; // "KEEP"
export const PAYLOAD_VERSION = 1;
const HEADER_LEN = 4 + 1 + 4;

export interface FileEntry {
  name: string;
  mime: string;
  /** byte offset into the body */
  offset: number;
  size: number;
}

export type PayloadType = 'text' | 'single_file' | 'multi_file';

export interface PayloadManifest {
  v: number;
  type: PayloadType;
  createdAt: number;
  files: FileEntry[];
  note?: string;
}

export interface PayloadInput {
  text?: string;
  files?: { name: string; mime: string; bytes: Uint8Array }[];
  note?: string;
}

export interface DecodedFile {
  entry: FileEntry;
  bytes: Uint8Array;
}

export interface DecodedPayload {
  manifest: PayloadManifest;
  files: DecodedFile[];
  /** Convenience: decoded text of the first text/* entry, if any. */
  text?: string;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function encodePayload(input: PayloadInput): Uint8Array {
  const parts: { name: string; mime: string; bytes: Uint8Array }[] = [];
  if (input.text && input.text.length > 0) {
    parts.push({
      name: 'message.txt',
      mime: 'text/plain',
      bytes: new TextEncoder().encode(input.text),
    });
  }
  for (const f of input.files ?? []) parts.push(f);

  if (parts.length === 0) {
    throw new Error('Cannot seal an empty payload — add a message or a file.');
  }

  const files: FileEntry[] = [];
  const bodies: Uint8Array[] = [];
  let offset = 0;
  for (const p of parts) {
    files.push({ name: p.name, mime: p.mime, offset, size: p.bytes.length });
    bodies.push(p.bytes);
    offset += p.bytes.length;
  }
  const body = concat(bodies);

  const hasFiles = (input.files?.length ?? 0) > 0;
  const type: PayloadType = parts.length > 1 ? 'multi_file' : hasFiles ? 'single_file' : 'text';

  const manifest: PayloadManifest = {
    v: PAYLOAD_VERSION,
    type,
    createdAt: Date.now(),
    files,
    note: input.note,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  const header = new Uint8Array(HEADER_LEN);
  header.set(PAYLOAD_MAGIC, 0);
  header[4] = PAYLOAD_VERSION;
  new DataView(header.buffer).setUint32(5, manifestBytes.length, true);

  return concat([header, manifestBytes, body]);
}

export function decodePayload(bytes: Uint8Array): DecodedPayload {
  if (bytes.length < HEADER_LEN) {
    throw new Error('Payload is too short to be a Keepra envelope.');
  }
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== PAYLOAD_MAGIC[i]) {
      throw new Error('This blob is not a Keepra payload (bad magic).');
    }
  }
  const version = bytes[4];
  if (version !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported Keepra payload version ${version}.`);
  }

  const manifestLen = new DataView(bytes.buffer, bytes.byteOffset + 5, 4).getUint32(0, true);
  const manifestStart = HEADER_LEN;
  const manifestEnd = manifestStart + manifestLen;
  if (manifestEnd > bytes.length) {
    throw new Error('Corrupt Keepra payload: manifest length exceeds blob size.');
  }

  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.subarray(manifestStart, manifestEnd)),
  ) as PayloadManifest;

  const body = bytes.subarray(manifestEnd);
  const files: DecodedFile[] = manifest.files.map((entry) => ({
    entry,
    bytes: body.subarray(entry.offset, entry.offset + entry.size),
  }));

  let text: string | undefined;
  const textFile = files.find((f) => f.entry.mime.startsWith('text/'));
  if (textFile) text = new TextDecoder().decode(textFile.bytes);

  return { manifest, files, text };
}
