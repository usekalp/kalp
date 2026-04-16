import { DurableObject } from 'cloudflare:workers';

/**
 * El "Cerebro" de la sala: Maneja SQL y WebSockets simultáneamente.
 */
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// Inicialización de la DB SQLite interna
		this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (
        id TEXT PRIMARY KEY,
        value TEXT
      )
    `);
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');

		// --- CASO 1: CONEXIÓN WEBSOCKET ---
		if (upgradeHeader === 'websocket') {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			// Aceptamos la conexión y la ponemos en modo "hibernación"
			this.ctx.acceptWebSocket(server as WebSocket);

			return new Response(null, {
				status: 101,
				webSocket: client as WebSocket,
			});
		}

		// --- CASO 2: PETICIÓN HTTP (GET/POST) ---
		// Esto sirve para el primer render o para clientes que no usan WS
		if (request.method === 'POST') {
			const body = await request.text(); // Recibimos el JSON como string
			this.ctx.storage.sql.exec('INSERT OR REPLACE INTO state (id, value) VALUES (?, ?)', 'main', body);
			return Response.json({ success: true });
		}

		const cursor = this.ctx.storage.sql.exec("SELECT value FROM state WHERE id = 'main'");

		// El cursor es un iterable. Tomamos el primer elemento manualmente.
		const row = cursor.next().value; // Si no hay nada, row será undefined

		const bodyToReturn = row?.value ? String(row.value) : JSON.stringify({ message: 'Sala vacía' });

		return new Response(bodyToReturn, {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	async webSocketMessage(ws: WebSocket, message: string) {
		console.log('Mensaje recibido en el DO:', message);

		this.ctx.storage.sql.exec('INSERT OR REPLACE INTO state (id, value) VALUES (?, ?)', 'main', message);

		const allSockets = this.ctx.getWebSockets();
		console.log(`Enviando broadcast a ${allSockets.length - 1} clientes adicionales`);

		allSockets.forEach((client) => {
			if (client !== ws) {
				client.send(message);
			}
		});
	}
}

// --- WORKER ENTRYPOINT ---

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request, env): Promise<Response> {
		// 1. Manejo de CORS Preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);
		const roomName = url.pathname.slice(1) || 'default';
		const id = env.MY_DURABLE_OBJECT.idFromName(roomName);
		const stub = env.MY_DURABLE_OBJECT.get(id);

		// 2. Delegar la petición al Durable Object
		const response = await stub.fetch(request);

		// --- EL FIX CRÍTICO ---
		// Si la respuesta es un cambio de protocolo (WebSocket),
		// la devolvemos DIRECTAMENTE sin tocar los headers ni el body.
		if (response.status === 101) {
			return response;
		}

		// 3. Solo para peticiones HTTP normales inyectamos los headers de CORS
		const newHeaders = new Headers(response.headers);
		Object.entries(corsHeaders).forEach(([key, value]) => {
			newHeaders.set(key, value);
		});

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders,
		});
	},
} satisfies ExportedHandler<Env>;
