import argon2 from "argon2";
import { ensureConnected } from "./client";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
  disabled_at: Date | null;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
};

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disabledAt: row.disabled_at,
  };
}

function normalizeDisplayName(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createUser(
  email: string,
  password: string,
): Promise<AuthUser> {
  const client = await ensureConnected();
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });
  try {
    const res = await client.query<UserRow>(
      `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, password_hash, display_name, created_at, updated_at, disabled_at
      `,
      [email.toLowerCase().trim(), passwordHash],
    );
    return mapUser(res.rows[0]);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      throw new Error("email_exists");
    }
    throw err;
  }
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const client = await ensureConnected();
  const res = await client.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at, disabled_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase().trim()],
  );
  const row = res.rows[0];
  if (!row) return null;
  return mapUser(row);
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const client = await ensureConnected();
  const res = await client.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at, disabled_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return mapUser(row);
}

export async function verifyUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const client = await ensureConnected();
  const res = await client.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at, updated_at, disabled_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase().trim()],
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.disabled_at) return null;
  let ok = false;
  try {
    ok = await argon2.verify(row.password_hash, password);
  } catch {
    return null;
  }
  if (!ok) return null;
  return mapUser(row);
}

export async function updateUserProfile(
  userId: string,
  fields: { displayName?: string | null },
): Promise<AuthUser | null> {
  const client = await ensureConnected();
  const displayName = normalizeDisplayName(fields.displayName);
  const res = await client.query<UserRow>(
    `
      UPDATE users
      SET display_name = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, password_hash, display_name, created_at, updated_at, disabled_at
    `,
    [userId, displayName],
  );
  const row = res.rows[0];
  if (!row) return null;
  return mapUser(row);
}
