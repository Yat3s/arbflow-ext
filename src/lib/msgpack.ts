export function decodeMsgpack(buffer: ArrayBuffer): unknown {
  const view = new DataView(buffer)
  let offset = 0

  function read(): unknown {
    const byte = view.getUint8(offset++)

    if (byte <= 0x7f) return byte

    if (byte >= 0x80 && byte <= 0x8f) {
      const size = byte & 0x0f
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < size; i++) {
        const key = read()
        obj[String(key)] = read()
      }
      return obj
    }

    if (byte >= 0x90 && byte <= 0x9f) {
      const size = byte & 0x0f
      const arr: unknown[] = []
      for (let i = 0; i < size; i++) arr.push(read())
      return arr
    }

    if (byte >= 0xa0 && byte <= 0xbf) {
      const size = byte & 0x1f
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size))
      offset += size
      return str
    }

    if (byte === 0xc0) return null
    if (byte === 0xc2) return false
    if (byte === 0xc3) return true

    if (byte === 0xc4) {
      const size = view.getUint8(offset++)
      const bin = new Uint8Array(buffer, offset, size)
      offset += size
      return bin
    }

    if (byte === 0xc5) {
      const size = view.getUint16(offset)
      offset += 2
      const bin = new Uint8Array(buffer, offset, size)
      offset += size
      return bin
    }

    if (byte === 0xca) {
      const val = view.getFloat32(offset)
      offset += 4
      return val
    }

    if (byte === 0xcb) {
      const val = view.getFloat64(offset)
      offset += 8
      return val
    }

    if (byte === 0xcc) return view.getUint8(offset++)

    if (byte === 0xcd) {
      const val = view.getUint16(offset)
      offset += 2
      return val
    }

    if (byte === 0xce) {
      const val = view.getUint32(offset)
      offset += 4
      return val
    }

    if (byte === 0xcf) {
      const high = view.getUint32(offset)
      const low = view.getUint32(offset + 4)
      offset += 8
      return high * 0x100000000 + low
    }

    if (byte === 0xd0) return view.getInt8(offset++)

    if (byte === 0xd1) {
      const val = view.getInt16(offset)
      offset += 2
      return val
    }

    if (byte === 0xd2) {
      const val = view.getInt32(offset)
      offset += 4
      return val
    }

    if (byte === 0xd3) {
      const high = view.getInt32(offset)
      const low = view.getUint32(offset + 4)
      offset += 8
      return high * 0x100000000 + low
    }

    if (byte === 0xd9) {
      const size = view.getUint8(offset++)
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size))
      offset += size
      return str
    }

    if (byte === 0xda) {
      const size = view.getUint16(offset)
      offset += 2
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size))
      offset += size
      return str
    }

    if (byte === 0xdb) {
      const size = view.getUint32(offset)
      offset += 4
      const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size))
      offset += size
      return str
    }

    if (byte === 0xdc) {
      const size = view.getUint16(offset)
      offset += 2
      const arr: unknown[] = []
      for (let i = 0; i < size; i++) arr.push(read())
      return arr
    }

    if (byte === 0xdd) {
      const size = view.getUint32(offset)
      offset += 4
      const arr: unknown[] = []
      for (let i = 0; i < size; i++) arr.push(read())
      return arr
    }

    if (byte === 0xde) {
      const size = view.getUint16(offset)
      offset += 2
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < size; i++) {
        const key = read()
        obj[String(key)] = read()
      }
      return obj
    }

    if (byte === 0xdf) {
      const size = view.getUint32(offset)
      offset += 4
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < size; i++) {
        const key = read()
        obj[String(key)] = read()
      }
      return obj
    }

    if (byte >= 0xe0) return byte - 256

    return { _unknown: byte, _offset: offset - 1 }
  }

  try {
    return read()
  } catch (e) {
    return { _error: (e as Error).message, _partial: true }
  }
}

