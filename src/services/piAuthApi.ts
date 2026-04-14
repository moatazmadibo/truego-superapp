import { supabase } from "../lib/supabase";

export type PiSyncedUser = {
  uid: string;
  username: string;
  walletAddress?: string | null;
  authenticatedAt: string;
};

export async function syncPiUser(accessToken: string): Promise<PiSyncedUser> {
  const { data, error } = await supabase.functions.invoke("pi-auth", {
    body: { accessToken },
  });

  if (error) {
    throw error;
  }

  if (!data?.uid || !data?.username) {
    throw new Error("Invalid pi-auth response.");
  }

  return data as PiSyncedUser;
}
