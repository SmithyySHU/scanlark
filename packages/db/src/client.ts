import { Client } from "pg";
import { DATABASE_URL } from "./env";

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
let connectingClient: Client | null = null;

export async function ensureConnected(): Promise<Client> {
  if (client) return client;
  if (connecting) return connecting;

  const url = DATABASE_URL;

  const c = new Client({ connectionString: url });
  connectingClient = c;
  // `pg` emits a client-level error when PostgreSQL disappears. Without a
  // listener Node terminates the process before a supervised worker tick can
  // classify/back off. Forget only this instance so the next operation can
  // establish a fresh connection after the database recovers.
  const forgetDisconnectedClient = () => {
    if (client === c) client = null;
  };
  c.on("error", forgetDisconnectedClient);
  c.on("end", forgetDisconnectedClient);

  connecting = c
    .connect()
    .then(() => {
      // Shutdown may have closed this socket while connect() was pending.
      // Never resurrect that client into the shared cache afterwards.
      if (connectingClient !== c) {
        void c.end().catch(() => undefined);
        throw new Error("database_connection_closed");
      }
      client = c;
      return c;
    })
    .finally(() => {
      connecting = null;
      if (connectingClient === c) connectingClient = null;
    });

  return connecting;
}

export async function closeConnection(): Promise<void> {
  const current = client ?? connectingClient;
  if (!current) return;
  client = null;
  if (connectingClient === current) connectingClient = null;
  await current.end().catch(() => undefined);
}
