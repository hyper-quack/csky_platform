// CSKY Platform — MAVLink 2 frame encoder (uplink: ground station → FC)
//
// Serializes a MAVLinkMessage instance whose fields are already populated. Field
// order and types come from the message's own `_message_fields`, so it stays in
// lockstep with the parser. Payloads are written full-length (no trailing-zero
// truncation) to keep the firmware decoder simple.

import { MAVLinkMessage } from './node-mavlink-shim'

const STX_V2 = 0xfd
let sequence = 0

function crcAccumulate(byte: number, crc: number): number {
  let tmp = (byte ^ (crc & 0xff)) & 0xff
  tmp = (tmp ^ (tmp << 4)) & 0xff
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff
}

const TYPE_SIZE: Record<string, number> = {
  uint8_t: 1, int8_t: 1, char: 1,
  uint16_t: 2, int16_t: 2,
  uint32_t: 4, int32_t: 4, float: 4,
  uint64_t: 8, int64_t: 8,
}

function fieldSize(type: string): number {
  if (type.includes('[')) {
    const base = type.split('[')[0]
    const n = parseInt(type.split('[')[1])
    return (TYPE_SIZE[base] ?? 1) * n
  }
  return TYPE_SIZE[type] ?? 1
}

function writeScalar(view: DataView, offset: number, type: string, value: number): number {
  switch (type) {
    case 'uint8_t': case 'char': view.setUint8(offset, value & 0xff); return offset + 1
    case 'int8_t': view.setInt8(offset, value); return offset + 1
    case 'uint16_t': view.setUint16(offset, value & 0xffff, true); return offset + 2
    case 'int16_t': view.setInt16(offset, value, true); return offset + 2
    case 'uint32_t': view.setUint32(offset, value >>> 0, true); return offset + 4
    case 'int32_t': view.setInt32(offset, value | 0, true); return offset + 4
    case 'float': view.setFloat32(offset, value, true); return offset + 4
    case 'uint64_t': view.setBigUint64(offset, BigInt(Math.trunc(value)), true); return offset + 8
    case 'int64_t': view.setBigInt64(offset, BigInt(Math.trunc(value)), true); return offset + 8
    default: view.setUint8(offset, value & 0xff); return offset + 1
  }
}

/** Encode a populated MAVLinkMessage into a MAVLink 2 frame ready for the wire. */
export function encodeMavlink2(msg: MAVLinkMessage, sysId = 255, compId = 190): Uint8Array {
  const payloadLen = msg._message_fields.reduce((s, [, type]) => s + fieldSize(type), 0)
  const payload = new Uint8Array(payloadLen)
  const view = new DataView(payload.buffer)

  let offset = 0
  for (const [name, type] of msg._message_fields) {
    const value = (msg as any)[name]
    if (type.includes('[')) {
      const base = type.split('[')[0]
      const n = parseInt(type.split('[')[1])
      const arr: number[] = Array.isArray(value) ? value : []
      for (let i = 0; i < n; i++) offset = writeScalar(view, offset, base, arr[i] ?? 0)
    } else {
      offset = writeScalar(view, offset, type, typeof value === 'number' ? value : 0)
    }
  }

  const msgId = msg._message_id
  const seq = sequence
  sequence = (sequence + 1) & 0xff

  const header = [payloadLen, 0, 0, seq, sysId, compId, msgId & 0xff, (msgId >> 8) & 0xff, (msgId >> 16) & 0xff]

  let crc = 0xffff
  for (const b of header) crc = crcAccumulate(b, crc)
  for (const b of payload) crc = crcAccumulate(b, crc)
  crc = crcAccumulate(msg._crc_extra, crc)

  const frame = new Uint8Array(1 + header.length + payloadLen + 2)
  frame[0] = STX_V2
  frame.set(header, 1)
  frame.set(payload, 1 + header.length)
  frame[frame.length - 2] = crc & 0xff
  frame[frame.length - 1] = (crc >> 8) & 0xff
  return frame
}
