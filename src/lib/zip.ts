interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = -1;

  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function dosTime(date: Date) {
  return ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
}

function dosDate(date: Date) {
  return (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
}

export function createZip(files: ZipFile[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local: number[] = [];

    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, time);
    writeUint16(local, date);
    writeUint32(local, crc);
    writeUint32(local, file.bytes.length);
    writeUint32(local, file.bytes.length);
    writeUint16(local, name.length);
    writeUint16(local, 0);

    const localBytes = new Uint8Array(local.length + name.length + file.bytes.length);
    localBytes.set(local);
    localBytes.set(name, local.length);
    localBytes.set(file.bytes, local.length + name.length);
    chunks.push(localBytes);

    const header: number[] = [];
    writeUint32(header, 0x02014b50);
    writeUint16(header, 20);
    writeUint16(header, 20);
    writeUint16(header, 0);
    writeUint16(header, 0);
    writeUint16(header, time);
    writeUint16(header, date);
    writeUint32(header, crc);
    writeUint32(header, file.bytes.length);
    writeUint32(header, file.bytes.length);
    writeUint16(header, name.length);
    writeUint16(header, 0);
    writeUint16(header, 0);
    writeUint16(header, 0);
    writeUint16(header, 0);
    writeUint32(header, 0);
    writeUint32(header, offset);
    const centralBytes = new Uint8Array(header.length + name.length);
    centralBytes.set(header);
    centralBytes.set(name, header.length);
    central.push(centralBytes);

    offset += localBytes.length;
  }

  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end: number[] = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, files.length);
  writeUint16(end, files.length);
  writeUint32(end, centralSize);
  writeUint32(end, offset);
  writeUint16(end, 0);

  return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/zip" });
}
