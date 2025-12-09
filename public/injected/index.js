(function() {
  'use strict';

  function decodeMsgpack(buffer) {
    const view = new DataView(buffer);
    let offset = 0;

    function read() {
      const byte = view.getUint8(offset++);
      if (byte <= 0x7f) return byte;
      if (byte >= 0x80 && byte <= 0x8f) {
        const size = byte & 0x0f;
        const obj = {};
        for (let i = 0; i < size; i++) {
          const key = read();
          obj[String(key)] = read();
        }
        return obj;
      }
      if (byte >= 0x90 && byte <= 0x9f) {
        const size = byte & 0x0f;
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(read());
        return arr;
      }
      if (byte >= 0xa0 && byte <= 0xbf) {
        const size = byte & 0x1f;
        const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size));
        offset += size;
        return str;
      }
      if (byte === 0xc0) return null;
      if (byte === 0xc2) return false;
      if (byte === 0xc3) return true;
      if (byte === 0xc4) {
        const size = view.getUint8(offset++);
        const bin = new Uint8Array(buffer, offset, size);
        offset += size;
        return bin;
      }
      if (byte === 0xc5) {
        const size = view.getUint16(offset);
        offset += 2;
        const bin = new Uint8Array(buffer, offset, size);
        offset += size;
        return bin;
      }
      if (byte === 0xca) { const val = view.getFloat32(offset); offset += 4; return val; }
      if (byte === 0xcb) { const val = view.getFloat64(offset); offset += 8; return val; }
      if (byte === 0xcc) return view.getUint8(offset++);
      if (byte === 0xcd) { const val = view.getUint16(offset); offset += 2; return val; }
      if (byte === 0xce) { const val = view.getUint32(offset); offset += 4; return val; }
      if (byte === 0xcf) {
        const high = view.getUint32(offset);
        const low = view.getUint32(offset + 4);
        offset += 8;
        return high * 0x100000000 + low;
      }
      if (byte === 0xd0) return view.getInt8(offset++);
      if (byte === 0xd1) { const val = view.getInt16(offset); offset += 2; return val; }
      if (byte === 0xd2) { const val = view.getInt32(offset); offset += 4; return val; }
      if (byte === 0xd3) {
        const high = view.getInt32(offset);
        const low = view.getUint32(offset + 4);
        offset += 8;
        return high * 0x100000000 + low;
      }
      if (byte === 0xd9) {
        const size = view.getUint8(offset++);
        const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size));
        offset += size;
        return str;
      }
      if (byte === 0xda) {
        const size = view.getUint16(offset);
        offset += 2;
        const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size));
        offset += size;
        return str;
      }
      if (byte === 0xdb) {
        const size = view.getUint32(offset);
        offset += 4;
        const str = new TextDecoder().decode(new Uint8Array(buffer, offset, size));
        offset += size;
        return str;
      }
      if (byte === 0xdc) {
        const size = view.getUint16(offset);
        offset += 2;
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(read());
        return arr;
      }
      if (byte === 0xdd) {
        const size = view.getUint32(offset);
        offset += 4;
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(read());
        return arr;
      }
      if (byte === 0xde) {
        const size = view.getUint16(offset);
        offset += 2;
        const obj = {};
        for (let i = 0; i < size; i++) {
          const key = read();
          obj[String(key)] = read();
        }
        return obj;
      }
      if (byte === 0xdf) {
        const size = view.getUint32(offset);
        offset += 4;
        const obj = {};
        for (let i = 0; i < size; i++) {
          const key = read();
          obj[String(key)] = read();
        }
        return obj;
      }
      if (byte >= 0xe0) return byte - 256;
      return { _unknown: byte, _offset: offset - 1 };
    }

    try {
      return read();
    } catch (e) {
      return { _error: e.message, _partial: true };
    }
  }

  function toOrderBookItems(levels) {
    if (!Array.isArray(levels)) return [];
    return levels.map(function(level) {
      if (Array.isArray(level)) {
        return { price: Number(level[0]) || 0, quantity: Number(level[1]) || 0 };
      }
      if (level && typeof level === 'object') {
        return {
          price: Number(level.price || level.p) || 0,
          quantity: Number(level.size || level.quantity || level.q) || 0,
        };
      }
      return { price: 0, quantity: 0 };
    });
  }

  function extractMarketIdFromChannel(channel) {
    if (!channel) return null;
    const match = channel.match(/[\/:](\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  const lighterParser = {
    parse: function(data) {
      if (!data || typeof data !== 'object') return null;
      if (data.order_book) {
        const orderBook = data.order_book;
        return {
          type: 'orderBook',
          orderBook: {
            bids: toOrderBookItems(orderBook.bids),
            asks: toOrderBookItems(orderBook.asks),
          },
          channel: data.channel,
        };
      }
      if (data.market_stats) {
        const stats = data.market_stats;
        return {
          type: 'marketStats',
          marketStats: {
            indexPrice: Number(stats.index_price) || 0,
            markPrice: Number(stats.mark_price) || 0,
            fundingRate: Number(stats.current_funding_rate) || 0,
          },
          channel: data.channel,
        };
      }
      return null;
    },
  };

  const omniParser = {
    parse: function(data) {
      if (!data || typeof data !== 'object') return null;
      if (data.type === 'quote' && data.data) {
        const quoteData = data.data;
        return {
          type: 'orderBook',
          orderBook: {
            bids: [{ price: Number(quoteData.bid) || 0, quantity: 1 }],
            asks: [{ price: Number(quoteData.ask) || 0, quantity: 1 }],
          },
          marketStats: {
            markPrice: Number(quoteData.mark_price) || 0,
            indexPrice: Number(quoteData.index_price) || 0,
          },
          symbol: data.symbol || (quoteData.instrument && quoteData.instrument.underlying),
        };
      }
      if (data.bid !== undefined && data.ask !== undefined) {
        return {
          type: 'orderBook',
          orderBook: {
            bids: [{ price: Number(data.bid) || 0, quantity: 1 }],
            asks: [{ price: Number(data.ask) || 0, quantity: 1 }],
          },
          marketStats: {
            markPrice: Number(data.mark_price) || 0,
            indexPrice: Number(data.index_price) || 0,
          },
          symbol: data.instrument && data.instrument.underlying,
        };
      }
      return null;
    },
  };

  function parseMessage(exchangeId, data) {
    if (!data || typeof data !== 'object') return null;
    const parser = exchangeId && exchangeId.toLowerCase() === 'omni' ? omniParser : lighterParser;
    return parser.parse(data);
  }

  function extractMarketId(exchangeId, channel) {
    if (exchangeId && exchangeId.toLowerCase() === 'lighter') {
      return extractMarketIdFromChannel(channel);
    }
    return null;
  }

  console.log('[Arbflow] 🔍 Interceptor script executing...');

  const activeWebSockets = new Map();
  const wsPingTimers = new Map();
  const wsMetadata = new Map();
  const DEFAULT_PING_INTERVAL = 2000;

  const arbflowWs = {
    connect: function(url, options) {
      options = options || {};
      const id = options.id || 'ws_' + Date.now();

      if (activeWebSockets.has(id)) {
        console.log('[Arbflow] WebSocket already exists with id:', id);
        return { success: false, error: 'WebSocket already exists' };
      }

      console.log('[Arbflow] 🔌 Creating WebSocket connection:', url);

      const exchange = id.startsWith('lighter-') ? 'lighter' : id.startsWith('omni-') ? 'omni' : null;
      const pingInterval = options.pingInterval || DEFAULT_PING_INTERVAL;

      wsMetadata.set(id, { exchange: exchange, pingInterval: pingInterval, symbols: options.symbols });

      try {
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        activeWebSockets.set(id, ws);

        ws.addEventListener('open', function() {
          console.log('[Arbflow] 🟢 WebSocket connected:', id);
          arbflowWs.startPing(id, pingInterval);
          window.postMessage({
            type: 'ARBFLOW_CUSTOM_WS_OPEN',
            id: id,
            url: url,
            timestamp: Date.now(),
          }, '*');
        });

        ws.addEventListener('message', function(event) {
          try {
            var data = null;
            var meta = wsMetadata.get(id);

            if (event.data instanceof Blob) {
              event.data.arrayBuffer().then(function(buffer) {
                processWsMessage(id, url, meta, decodeMsgpack(buffer));
              });
              return;
            } else if (event.data instanceof ArrayBuffer) {
              data = decodeMsgpack(event.data);
            } else if (typeof event.data === 'string') {
              try {
                data = JSON.parse(event.data);
              } catch (e) {
                data = event.data;
              }
            }

            processWsMessage(id, url, meta, data);
          } catch (e) {
            console.log('[Arbflow] WS decode error:', e);
          }
        });

        ws.addEventListener('close', function(event) {
          console.log('[Arbflow] 🔴 WebSocket closed:', id, event.code);
          arbflowWs.stopPing(id);
          activeWebSockets.delete(id);
          wsMetadata.delete(id);
          window.postMessage({
            type: 'ARBFLOW_CUSTOM_WS_CLOSE',
            id: id,
            url: url,
            code: event.code,
            timestamp: Date.now(),
          }, '*');
        });

        ws.addEventListener('error', function() {
          console.log('[Arbflow] ❌ WebSocket error:', id);
          window.postMessage({
            type: 'ARBFLOW_CUSTOM_WS_ERROR',
            id: id,
            url: url,
            timestamp: Date.now(),
          }, '*');
        });

        return { success: true, id: id };
      } catch (e) {
        console.log('[Arbflow] Failed to create WebSocket:', e);
        wsMetadata.delete(id);
        return { success: false, error: e.message };
      }
    },

    startPing: function(id, interval) {
      arbflowWs.stopPing(id);
      var timer = setInterval(function() {
        var ws = activeWebSockets.get(id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {
            console.log('[Arbflow] Ping failed:', e);
          }
        }
      }, interval || DEFAULT_PING_INTERVAL);
      wsPingTimers.set(id, timer);
      console.log('[Arbflow] 🏓 Started ping timer for:', id, 'interval:', interval);
    },

    stopPing: function(id) {
      var timer = wsPingTimers.get(id);
      if (timer) {
        clearInterval(timer);
        wsPingTimers.delete(id);
        console.log('[Arbflow] 🏓 Stopped ping timer for:', id);
      }
    },

    send: function(id, data) {
      var ws = activeWebSockets.get(id);
      console.log('[Arbflow] WS send:', { id: id, data: data, wsExists: !!ws, readyState: ws && ws.readyState });
      if (ws && ws.readyState === WebSocket.OPEN) {
        var msg = typeof data === 'string' ? data : JSON.stringify(data);
        console.log('[Arbflow] 📤 Sending to WS:', msg);
        ws.send(msg);
        return { success: true };
      }
      console.log('[Arbflow] ❌ Cannot send: WebSocket not connected');
      return { success: false, error: 'WebSocket not connected' };
    },
  };

  function processWsMessage(id, url, meta, data) {
    if (data && data.type === 'ping') {
      console.log('[Arbflow] 🏓 Received ping, sending pong');
      var ws = activeWebSockets.get(id);
      if (ws) ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (data && data.type === 'pong') {
      return;
    }

    var parserKey = (meta && meta.exchange) || 'lighter';
    var parsed = parseMessage(parserKey, data);
    var marketId = extractMarketId(parserKey, data && data.channel);

    if (parsed) {
      console.log('[Arbflow] 📊 Parsed data:', {
        exchange: parserKey,
        marketId: marketId,
        parsed: parsed,
        channel: data && data.channel,
      });
    }

    window.postMessage({
      type: 'ARBFLOW_CUSTOM_WS_MESSAGE',
      id: id,
      url: url,
      data: data,
      parsed: parsed,
      marketId: marketId,
      timestamp: Date.now(),
    }, '*');
  }

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'ARBFLOW_WS_COMMAND') return;

    var command = event.data.command;
    var params = Object.assign({}, event.data);
    delete params.type;
    delete params.command;

    console.log('[Arbflow] Injected received WS_COMMAND:', command, params);
    var result = null;

    switch (command) {
      case 'connect':
        result = arbflowWs.connect(params.url, params.options);
        break;
      case 'send':
        result = arbflowWs.send(params.id, params.data);
        break;
    }
    console.log('[Arbflow] WS_COMMAND result:', result);

    if (result) {
      window.postMessage({
        type: 'ARBFLOW_WS_COMMAND_RESULT',
        command: command,
        result: result,
        timestamp: Date.now(),
      }, '*');
    }
  });

  var activeHttpPollers = new Map();

  var arbflowHttp = {
    startPolling: function(url, options) {
      options = options || {};
      var id = options.id || 'http_' + Date.now();
      var interval = options.interval || 1000;
      var body = options.body || {};
      var symbol = options.symbol;

      if (activeHttpPollers.has(id)) {
        console.log('[Arbflow] HTTP poller already exists with id:', id);
        return { success: false, error: 'Poller already exists' };
      }

      console.log('[Arbflow] 🔄 Starting HTTP polling:', { id: id, url: url, interval: interval });

      var poll = function() {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
          .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function(data) {
            var parsed = parseMessage('omni', data);
            if (parsed) {
              console.log('[Arbflow] 📊 Omni HTTP parsed:', { symbol: symbol, parsed: parsed });
            }
            window.postMessage({
              type: 'ARBFLOW_HTTP_RESPONSE',
              id: id,
              url: url,
              data: data,
              parsed: parsed,
              symbol: symbol,
              timestamp: Date.now(),
            }, '*');
          })
          .catch(function(e) {
            console.log('[Arbflow] HTTP poll error:', e);
            window.postMessage({
              type: 'ARBFLOW_HTTP_ERROR',
              id: id,
              url: url,
              error: e.message,
              symbol: symbol,
              timestamp: Date.now(),
            }, '*');
          });
      };

      poll();
      var timer = setInterval(poll, interval);
      activeHttpPollers.set(id, { timer: timer, url: url, symbol: symbol });

      window.postMessage({
        type: 'ARBFLOW_HTTP_START',
        id: id,
        url: url,
        symbol: symbol,
        timestamp: Date.now(),
      }, '*');

      return { success: true, id: id };
    },

    stopPolling: function(id) {
      var poller = activeHttpPollers.get(id);
      if (poller) {
        clearInterval(poller.timer);
        activeHttpPollers.delete(id);
        console.log('[Arbflow] 🛑 Stopped HTTP polling:', id);
        window.postMessage({
          type: 'ARBFLOW_HTTP_STOP',
          id: id,
          timestamp: Date.now(),
        }, '*');
        return { success: true };
      }
      return { success: false, error: 'Poller not found' };
    },

    stopAll: function() {
      activeHttpPollers.forEach(function(_, id) {
        arbflowHttp.stopPolling(id);
      });
    },
  };

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'ARBFLOW_HTTP_COMMAND') return;

    var command = event.data.command;
    var params = Object.assign({}, event.data);
    delete params.type;
    delete params.command;

    console.log('[Arbflow] Injected received HTTP_COMMAND:', command, params);
    var result = null;

    switch (command) {
      case 'startPolling':
        result = arbflowHttp.startPolling(params.url, params.options);
        break;
      case 'stopPolling':
        result = arbflowHttp.stopPolling(params.id);
        break;
      case 'stopAll':
        arbflowHttp.stopAll();
        result = { success: true };
        break;
    }
    console.log('[Arbflow] HTTP_COMMAND result:', result);
  });

  var arbflowTrade = {
    executeOmniTrade: function(params) {
      var underlying = params.underlying;
      var size = params.size;
      var side = params.side;
      var maxSlippage = params.maxSlippage || 0.005;

      console.log('[Arbflow] 🔄 Executing Omni trade:', params);

      var quoteBody = {
        instrument: {
          underlying: underlying,
          funding_interval_s: 3600,
          settlement_asset: 'USDC',
          instrument_type: 'perpetual_future',
        },
        qty: String(size),
      };

      console.log('[Arbflow] 📤 Requesting quote:', quoteBody);

      fetch('https://omni.variational.io/api/quotes/indicative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteBody),
      })
        .then(function(response) {
          if (!response.ok) throw new Error('Quote request failed: HTTP ' + response.status);
          return response.json();
        })
        .then(function(quoteData) {
          console.log('[Arbflow] 📥 Quote response:', quoteData);

          var quoteId = quoteData.quote_id;
          if (!quoteId) throw new Error('No quote_id in response');

          window.postMessage({
            type: 'ARBFLOW_TRADE_QUOTE',
            quoteId: quoteId,
            quoteData: quoteData,
            timestamp: Date.now(),
          }, '*');

          var orderBody = {
            quote_id: quoteId,
            side: side,
            max_slippage: maxSlippage,
            is_reduce_only: false,
          };

          console.log('[Arbflow] 📤 Submitting order:', orderBody);

          return fetch('https://omni.variational.io/api/orders/new/market', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderBody),
          });
        })
        .then(function(response) {
          if (!response.ok) {
            return response.text().then(function(text) {
              throw new Error('Order request failed: HTTP ' + response.status + ' - ' + text);
            });
          }
          return response.json();
        })
        .then(function(orderData) {
          console.log('[Arbflow] 📥 Order response:', orderData);

          window.postMessage({
            type: 'ARBFLOW_TRADE_ORDER',
            orderData: orderData,
            timestamp: Date.now(),
          }, '*');
        })
        .catch(function(e) {
          console.error('[Arbflow] ❌ Trade error:', e);
          window.postMessage({
            type: 'ARBFLOW_TRADE_ERROR',
            error: e.message,
            timestamp: Date.now(),
          }, '*');
        });
    },
  };

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'ARBFLOW_TRADE') return;

    var exchangeId = event.data.exchangeId;
    var params = event.data.params;
    console.log('[Arbflow] Injected received TRADE:', { exchangeId: exchangeId, params: params });

    if (exchangeId === 'OM') {
      arbflowTrade.executeOmniTrade(params);
    }
  });

  console.log('[Arbflow] ✅ Interceptor loaded');
})();

