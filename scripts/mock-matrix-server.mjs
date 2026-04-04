import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.MATRIX_MOCK_PORT ?? '8787');
const HOST = '127.0.0.1';

const ROOM_ID = '!sinnamon:local';
const USER_ID = '@tester:local';
const DEVICE_ID = 'SNNMDEVICE';
const ACCESS_TOKEN = 'sinnamon-mock-token';
const wasmFilePath = path.resolve(
  process.cwd(),
  'node_modules',
  '@matrix-org',
  'matrix-sdk-crypto-wasm',
  'pkg',
  'matrix_sdk_crypto_wasm_bg.wasm',
);

let messageCounter = 1;
const timeline = [
  {
    event_id: '$welcome-1',
    sender: '@system:local',
    type: 'm.room.message',
    origin_server_ts: Date.now() - 12000,
    content: {
      msgtype: 'm.notice',
      body: 'Sinnamon local Matrix mock server is connected.',
    },
  },
  {
    event_id: '$welcome-2',
    sender: '@system:local',
    type: 'm.room.message',
    origin_server_ts: Date.now() - 8000,
    content: {
      msgtype: 'm.text',
      body: 'This is a credential-free local test feed.',
    },
  },
];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  sendJson(response, 404, {
    errcode: 'M_NOT_FOUND',
    error: 'Endpoint not implemented in local mock server.',
  });
}

async function trySendWasm(response, requestPath) {
  if (!requestPath.endsWith('.wasm')) {
    return false;
  }

  if (!requestPath.includes('matrix_sdk_crypto_wasm_bg.wasm')) {
    return false;
  }

  try {
    const binary = await readFile(wasmFilePath);
    response.writeHead(200, {
      'Content-Type': 'application/wasm',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    });
    response.end(binary);
    return true;
  } catch {
    return false;
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    request.on('data', (chunk) => {
      chunks += chunk;
    });
    request.on('end', () => resolve(chunks));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  const path = requestUrl.pathname;
  const method = request.method ?? 'GET';

  if (method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (method === 'GET' && await trySendWasm(response, path)) {
    return;
  }

  if (method === 'POST' && path === '/_matrix/client/v3/login') {
    sendJson(response, 200, {
      access_token: ACCESS_TOKEN,
      user_id: USER_ID,
      device_id: DEVICE_ID,
      well_known: {
        'm.homeserver': {
          base_url: `http://${HOST}:${PORT}`,
        },
      },
    });
    return;
  }

  if (method === 'GET' && path === '/_matrix/client/v3/sync') {
    sendJson(response, 200, {
      next_batch: `mock_${Date.now()}`,
      rooms: {
        join: {
          [ROOM_ID]: {
            unread_notifications: { notification_count: 1 },
            summary: {
              'm.heroes': ['@system:local', USER_ID],
            },
            state: {
              events: [
                {
                  type: 'm.room.name',
                  content: { name: 'local-sinnamon-test' },
                },
                {
                  type: 'm.room.topic',
                  content: { topic: 'Local mock Matrix server validation room' },
                },
                {
                  type: 'm.room.encryption',
                  content: { algorithm: 'm.megolm.v1.aes-sha2' },
                },
                {
                  type: 'm.room.member',
                  state_key: USER_ID,
                  content: {
                    membership: 'join',
                    displayname: 'Sinnamon Tester',
                  },
                },
              ],
            },
            timeline: {
              events: timeline,
            },
            ephemeral: {
              events: [
                {
                  type: 'm.typing',
                  content: { user_ids: [] },
                },
              ],
            },
          },
        },
      },
    });
    return;
  }

  if (method === 'GET' && path === '/_matrix/client/v3/room_keys/version') {
    sendJson(response, 200, {
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      version: '1',
      count: 0,
      etag: 'mock-etag',
    });
    return;
  }

  if (method === 'GET' && path.startsWith('/_matrix/client/v3/rooms/') && path.endsWith('/members')) {
    sendJson(response, 200, {
      chunk: [
        {
          type: 'm.room.member',
          state_key: USER_ID,
          content: {
            membership: 'join',
            displayname: 'Sinnamon Tester',
          },
        },
        {
          type: 'm.room.member',
          state_key: '@system:local',
          content: {
            membership: 'join',
            displayname: 'Matrix Mock Bot',
          },
        },
      ],
    });
    return;
  }

  if (method === 'PUT' && path.includes('/send/m.room.message/')) {
    const rawBody = await readBody(request);
    let parsedBody = {};
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }

    const eventId = `$mock-${messageCounter++}`;
    timeline.push({
      event_id: eventId,
      sender: USER_ID,
      type: 'm.room.message',
      origin_server_ts: Date.now(),
      content: {
        msgtype: typeof parsedBody.msgtype === 'string' ? parsedBody.msgtype : 'm.text',
        body: typeof parsedBody.body === 'string' ? parsedBody.body : '',
      },
    });

    sendJson(response, 200, { event_id: eventId });
    return;
  }

  if (method === 'PUT' && path.includes('/typing/')) {
    sendJson(response, 200, {});
    return;
  }

  if (method === 'POST' && path.includes('/receipt/m.read/')) {
    sendJson(response, 200, {});
    return;
  }

  notFound(response);
});

server.listen(PORT, HOST, () => {
  console.log(`Sinnamon mock Matrix server running at http://${HOST}:${PORT}`);
  console.log('Use these values in Settings > My Account for local testing:');
  console.log(`  Homeserver URL: http://${HOST}:${PORT}`);
  console.log(`  Username: ${USER_ID}`);
  console.log('  Password: any value (mock login always succeeds)');
});
