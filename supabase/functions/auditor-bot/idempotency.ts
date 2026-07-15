export const DEFAULT_CLAIM_LEASE_MS = 120_000;

export type ClaimIdentity = {
  owner: string;
  attempt: string;
};

export type UpdateClaimResult = "claimed" | "completed" | "processing";

export type IdempotencyStore = {
  claimUpdate(
    updateId: number,
    identity: ClaimIdentity,
    leaseMs?: number,
  ): Promise<UpdateClaimResult>;
  completeUpdate(updateId: number, owner: string): Promise<void>;
  releaseUpdate(updateId: number, owner: string): Promise<void>;
};

export function ownsCallback(
  sessionTelegramId: number,
  actorTelegramId: number,
): boolean {
  return sessionTelegramId === actorTelegramId;
}
