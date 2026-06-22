

export class MAVLinkMessage {
  public _message_id!: number;
  public _message_name!: string;
  public _crc_extra!: number;
  public _message_fields!: [string, string, boolean][];
}

export function readInt64LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return Number(view.getBigInt64(offset, true));
}

export function readUInt64LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return Number(view.getBigUint64(offset, true));
}


