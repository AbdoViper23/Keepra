import { describe, expect, it } from 'vitest';

import { decodePayload, encodePayload, PAYLOAD_MAGIC } from './payload';

describe('payload envelope', () => {
  it('roundtrips a text-only payload', () => {
    const text = 'Dear Maya, the keys are in the blue box. — Alice';
    const decoded = decodePayload(encodePayload({ text }));
    expect(decoded.manifest.type).toBe('text');
    expect(decoded.text).toBe(text);
    expect(decoded.files).toHaveLength(1);
    expect(decoded.files[0]?.entry.mime).toBe('text/plain');
  });

  it('roundtrips a single binary file', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 0, 99]);
    const decoded = decodePayload(
      encodePayload({ files: [{ name: 'key.bin', mime: 'application/octet-stream', bytes }] }),
    );
    expect(decoded.manifest.type).toBe('single_file');
    expect(decoded.files).toHaveLength(1);
    expect(Array.from(decoded.files[0]!.bytes)).toEqual(Array.from(bytes));
  });

  it('roundtrips multiple files with correct offsets', () => {
    const a = new Uint8Array([10, 11, 12]);
    const b = new Uint8Array(300).fill(7);
    const decoded = decodePayload(
      encodePayload({
        text: 'note',
        files: [
          { name: 'a.bin', mime: 'application/octet-stream', bytes: a },
          { name: 'b.bin', mime: 'application/octet-stream', bytes: b },
        ],
      }),
    );
    expect(decoded.manifest.type).toBe('multi_file');
    expect(decoded.files).toHaveLength(3); // message.txt + a + b
    const fileA = decoded.files.find((f) => f.entry.name === 'a.bin')!;
    const fileB = decoded.files.find((f) => f.entry.name === 'b.bin')!;
    expect(Array.from(fileA.bytes)).toEqual(Array.from(a));
    expect(fileB.bytes.length).toBe(300);
    expect(fileB.bytes.every((x) => x === 7)).toBe(true);
  });

  it('writes the KEEP magic and version', () => {
    const blob = encodePayload({ text: 'x' });
    expect(Array.from(blob.subarray(0, 4))).toEqual([...PAYLOAD_MAGIC]);
    expect(blob[4]).toBe(1);
  });

  it('rejects an empty payload', () => {
    expect(() => encodePayload({})).toThrow();
  });

  it('rejects a blob with bad magic', () => {
    const bogus = new Uint8Array(20);
    expect(() => decodePayload(bogus)).toThrow();
  });

  it('roundtrips correctly even when decoding a subarray-backed buffer', () => {
    // Guards the DataView byteOffset handling.
    const inner = encodePayload({ text: 'offset-safety' });
    const padded = new Uint8Array(inner.length + 16);
    padded.set(inner, 16);
    const view = padded.subarray(16);
    expect(decodePayload(view).text).toBe('offset-safety');
  });
});
