import { messageRegistry } from './message-registry'
import { MAVLinkMessage } from './node-mavlink-shim'

export class MavlinkStreamParser {
  private buffer = new Uint8Array(8192);
  private head = 0;
  private tail = 0;
  private state = 0;
  private expectedLen = 0;
  private onMessage: (msg: MAVLinkMessage) => void;

  constructor(onMessage: (msg: MAVLinkMessage) => void) {
    this.onMessage = onMessage;
  }

  public feed(chunk: Uint8Array) {
    for (let i = 0; i < chunk.length; i++) {
      this.buffer[this.tail] = chunk[i];
      this.tail = (this.tail + 1) % this.buffer.length;
    }
    this.process();
  }

  private process() {
    let available = (this.tail - this.head + this.buffer.length) % this.buffer.length;
    while (available > 0) {
      if (this.state === 0) {
        if (this.buffer[this.head] === 0xFD || this.buffer[this.head] === 0xFE) {
          // console.log("Found magic", this.buffer[this.head].toString(16));
          this.state = 1;
        } else {
          this.head = (this.head + 1) % this.buffer.length;
          available--;
        }
      } else if (this.state === 1) {
        const magic = this.buffer[this.head];
        const headerLen = magic === 0xFD ? 10 : 6;
        if (available >= headerLen) {
          this.expectedLen = this.buffer[(this.head + 1) % this.buffer.length];
          this.state = 2;
        } else {
          break;
        }
      } else if (this.state === 2) {
        const magic = this.buffer[this.head];
        const headerLen = magic === 0xFD ? 10 : 6;
        
        // Check for MAVLink 2 signature
        let sigLen = 0;
        if (magic === 0xFD) {
          const incompatFlags = this.buffer[(this.head + 2) % this.buffer.length];
          if (incompatFlags & 0x01) {
            sigLen = 13;
          }
        }
        
        const totalPacketSize = headerLen + this.expectedLen + 2 + sigLen; // +2 for CRC, +13 for signature if present
        if (available >= totalPacketSize) {
          this.parsePacket(totalPacketSize, magic);
          this.head = (this.head + totalPacketSize) % this.buffer.length;
          available -= totalPacketSize;
          this.state = 0;
        } else {
          break;
        }
      }
    }
  }

  private parsePacket(totalLen: number, magic: number) {
    const packet = new Uint8Array(totalLen);
    for (let i = 0; i < totalLen; i++) {
      packet[i] = this.buffer[(this.head + i) % this.buffer.length];
    }
    
    let msgId: number;
    let payloadLen: number;
    let payload: Uint8Array;
    let sysId: number;
    let compId: number;

    if (magic === 0xFD) { // MAVLink 2
      msgId = packet[7] | (packet[8] << 8) | (packet[9] << 16);
      payloadLen = packet[1];
      sysId = packet[5];
      compId = packet[6];
      payload = packet.subarray(10, 10 + payloadLen);
    } else { // MAVLink 1
      msgId = packet[5];
      payloadLen = packet[1];
      sysId = packet[3];
      compId = packet[4];
      payload = packet.subarray(6, 6 + payloadLen);
    }

    const match = messageRegistry.find(r => r[0] === msgId);
    if (!match) {
      console.log(`[MAVLink Parser] Unknown msgId: ${msgId} (Magic: ${magic.toString(16)}, Len: ${payloadLen})`);
      return;
    }
    
    const MsgClass = match[1];
    const msg = new MsgClass(sysId, compId);

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    for (const [name, type] of msg._message_fields) {
      if (offset >= payload.byteLength) break;
      
      try {
        let val: any = 0;
        if (type === 'uint8_t') { val = view.getUint8(offset); offset += 1; }
        else if (type === 'int8_t') { val = view.getInt8(offset); offset += 1; }
        else if (type === 'uint16_t') { val = view.getUint16(offset, true); offset += 2; }
        else if (type === 'int16_t') { val = view.getInt16(offset, true); offset += 2; }
        else if (type === 'uint32_t') { val = view.getUint32(offset, true); offset += 4; }
        else if (type === 'int32_t') { val = view.getInt32(offset, true); offset += 4; }
        else if (type === 'float') { val = view.getFloat32(offset, true); offset += 4; }
        else if (type === 'uint64_t' || type === 'int64_t') { 
          val = Number(view.getBigUint64(offset, true)); 
          offset += 8; 
        }
        else if (type.includes('[')) {
          const base = type.split('[')[0];
          const num = parseInt(type.split('[')[1]);
          val = [];
          for (let i=0; i<num; i++) {
            if (offset >= payload.byteLength) break;
            if (base === 'int8_t') { val.push(view.getInt8(offset)); offset += 1; }
            else if (base === 'uint16_t') { val.push(view.getUint16(offset, true)); offset += 2; }
            else if (base === 'int16_t') { val.push(view.getInt16(offset, true)); offset += 2; }
            else if (base === 'uint32_t') { val.push(view.getUint32(offset, true)); offset += 4; }
            else if (base === 'int32_t') { val.push(view.getInt32(offset, true)); offset += 4; }
            else if (base === 'float') { val.push(view.getFloat32(offset, true)); offset += 4; }
            else { val.push(view.getUint8(offset)); offset += 1; } // uint8_t / char
          }
        }
        
        (msg as any)[name] = val;
      } catch (e) {
        break;
      }
    }
    
    this.onMessage(msg);
  }
}
