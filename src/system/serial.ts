/// <reference types="w3c-web-serial" />
// CSKY Platform — MAVLink 2 Parser & Serial Link

import { MAVLinkMessage } from './mavlink/node-mavlink-shim'
import { MavlinkStreamParser } from './mavlink/parser'

let firstMessageReceived = false
let waitResolve: ((val: boolean) => void) | null = null

// Export a pub/sub hook so telemetry.ts can listen
export const mavlinkParser = new MavlinkStreamParser((msg: MAVLinkMessage) => {
  if (!firstMessageReceived) {
    firstMessageReceived = true
    if (waitResolve) {
      waitResolve(true)
      waitResolve = null
    }
  }
  if (onMavlinkMessage) onMavlinkMessage(msg)
})

let onMavlinkMessage: ((msg: MAVLinkMessage) => void) | null = null
export function setMavlinkHandler(handler: (msg: MAVLinkMessage) => void) {
  onMavlinkMessage = handler
}

export function feedMavlink(chunk: Uint8Array) {
  mavlinkParser.feed(chunk)
}

let port: SerialPort | null = null
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
let isConnected = false

export async function requestSerialPort(): Promise<boolean> {
  try {
    // Request port via WebSerial
    port = await navigator.serial.requestPort()
    await port.open({ baudRate: 115200 }) // Baud rate ignored for CDC, but required API arg
    
    // Crucial for Flight Controllers: Assert DTR/RTS so the FC knows a terminal is connected
    await port.setSignals({ dataTerminalReady: true, requestToSend: true })
    
    isConnected = true
    firstMessageReceived = false
    
    // Start reading loop
    readLoop()

    return new Promise(resolve => {
      waitResolve = resolve
      setTimeout(() => {
        if (!firstMessageReceived) {
          waitResolve = null
          console.error('Serial port opened, but no MAVLink packets received. Disconnecting.')
          disconnectSerial()
          resolve(false)
        }
      }, 5000) // 5 seconds timeout
    })
  } catch (err) {
    console.error('Failed to open serial port:', err)
    return false
  }
}

async function readLoop() {
  if (!port) return
  while (port.readable && isConnected) {
    reader = port.readable.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          // console.log(`[WebSerial] Read chunk of ${value.length} bytes`);
          feedMavlink(value)
        }
      }
    } catch (err) {
      console.error('Read loop error:', err)
    } finally {
      reader.releaseLock()
    }
  }
}

export function isSerialConnected() {
  return isConnected
}

// Cleanly disconnect
export async function disconnectSerial() {
  isConnected = false
  if (reader) {
    await reader.cancel()
    reader = null
  }
  if (port) {
    await port.close()
    port = null
  }
}
