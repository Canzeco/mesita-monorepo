import * as aes from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import kv from "expo-sqlite/kv-store";

// Two stores. `plain` holds preferences only (the chosen location, "seen"
// marks). `secret` holds anything personal: Supabase's LargeSecureStore
// pattern, the key in the Keychain / Keystore and the AES-CTR text in SQLite.
// One key for the app, a fresh counter per write stored beside the text, so a
// value is replaced in one write and a kill cannot leave half of it.

export const plain = {
  get: (name: string) => kv.getItem(name),
  set: (name: string, value: string) => kv.setItem(name, value),
  remove: (name: string) => kv.removeItem(name),
};

const KEY_NAME = "mesita.storage.key";
let key: Promise<Uint8Array> | null = null;

async function loadKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(KEY_NAME);
  if (stored) return aes.utils.hex.toBytes(stored);
  const made = Crypto.getRandomValues(new Uint8Array(32));
  await SecureStore.setItemAsync(KEY_NAME, aes.utils.hex.fromBytes(made), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return made;
}

function getKey(): Promise<Uint8Array> {
  key ??= loadKey().catch((err) => {
    key = null;
    throw err;
  });
  return key;
}

const MARK = "mesita1:";

export const secret = {
  async get(name: string): Promise<string | null> {
    const stored = await kv.getItem(name);
    if (!stored) return null;
    try {
      const [counter, text] = stored.split(":");
      const ctr = new aes.ModeOfOperation.ctr(await getKey(), new aes.Counter(aes.utils.hex.toBytes(counter)));
      const value = aes.utils.utf8.fromBytes(ctr.decrypt(aes.utils.hex.toBytes(text)));
      // A key lost with the Keychain decrypts to noise.
      return value.startsWith(MARK) ? value.slice(MARK.length) : null;
    } catch {
      return null;
    }
  },
  async set(name: string, value: string): Promise<void> {
    const counter = Crypto.getRandomValues(new Uint8Array(16));
    const ctr = new aes.ModeOfOperation.ctr(await getKey(), new aes.Counter(counter));
    const text = ctr.encrypt(aes.utils.utf8.toBytes(MARK + value));
    await kv.setItem(name, `${aes.utils.hex.fromBytes(counter)}:${aes.utils.hex.fromBytes(text)}`);
  },
  remove: (name: string) => kv.removeItem(name),
};
