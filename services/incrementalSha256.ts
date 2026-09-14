const INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotateRight = (value: number, bits: number): number => (
  (value >>> bits) | (value << (32 - bits))
);

export class IncrementalSha256 {
  private readonly hash = [...INITIAL_HASH];
  private readonly buffer = new Uint8Array(64);
  private bufferLength = 0;
  private bytesHashed = 0;
  private finished = false;

  update(input: Uint8Array | ArrayBuffer | string): this {
    if (this.finished) throw new Error('SHA-256 digest has already been finalized.');
    const data = typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : input;
    let offset = 0;
    this.bytesHashed += data.length;

    while (offset < data.length) {
      const space = 64 - this.bufferLength;
      const take = Math.min(space, data.length - offset);
      this.buffer.set(data.subarray(offset, offset + take), this.bufferLength);
      this.bufferLength += take;
      offset += take;

      if (this.bufferLength === 64) {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }
    }
    return this;
  }

  digest(): Uint8Array {
    if (!this.finished) {
      const bitLengthHigh = Math.floor((this.bytesHashed * 8) / 0x100000000);
      const bitLengthLow = (this.bytesHashed * 8) >>> 0;
      this.buffer[this.bufferLength++] = 0x80;

      if (this.bufferLength > 56) {
        this.buffer.fill(0, this.bufferLength, 64);
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }

      this.buffer.fill(0, this.bufferLength, 56);
      const view = new DataView(this.buffer.buffer);
      view.setUint32(56, bitLengthHigh, false);
      view.setUint32(60, bitLengthLow, false);
      this.processBlock(this.buffer);
      this.bufferLength = 0;
      this.finished = true;
    }

    const output = new Uint8Array(32);
    const view = new DataView(output.buffer);
    for (let index = 0; index < this.hash.length; index++) {
      view.setUint32(index * 4, this.hash[index] >>> 0, false);
    }
    return output;
  }

  hexDigest(): string {
    return Array.from(this.digest(), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private processBlock(block: Uint8Array): void {
    const words = new Uint32Array(64);
    const view = new DataView(block.buffer, block.byteOffset, 64);
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(index * 4, false);
    for (let index = 16; index < 64; index++) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = this.hash;
    for (let index = 0; index < 64; index++) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + ROUND_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    this.hash[0] = (this.hash[0] + a) >>> 0;
    this.hash[1] = (this.hash[1] + b) >>> 0;
    this.hash[2] = (this.hash[2] + c) >>> 0;
    this.hash[3] = (this.hash[3] + d) >>> 0;
    this.hash[4] = (this.hash[4] + e) >>> 0;
    this.hash[5] = (this.hash[5] + f) >>> 0;
    this.hash[6] = (this.hash[6] + g) >>> 0;
    this.hash[7] = (this.hash[7] + h) >>> 0;
  }
}

export const sha256Hex = (input: Uint8Array | ArrayBuffer | string): string => (
  new IncrementalSha256().update(input).hexDigest()
);
