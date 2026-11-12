# Managed chat Spaces

The browser chat supports creating a Space, generating a signed invitation URL/QR, previewing it, explicitly requesting access, and owner approval. Spaces include channels and account-level moderator roles. Friends/direct messages remain separate from Space membership. Merely opening a link or receiving an invitation does not join a Space or disclose its encryption key.

## Joining and management

- Create a Space, open its conversation settings, then choose **Generate invitation**. The link expires after 24 hours. The controller accepts lifetimes from one minute to seven days.
- Share the URL or QR. Invitation metadata includes the Space name, network and owner account/device certificate, but no group key.
- The recipient chooses **Request to join**. The original owner device must open Chat and approve the request. No centralized join service is assumed.
- The owner can decline requests, revoke links and remove members. Members can leave. Removal applies to all of that account's member devices, rotates the group key and revokes every existing invite and pending request.
- Join and removal both rotate the key. New members do not receive old epoch keys; removed members do not receive the new key. Existing local message history remains available.
- Legacy Spaces remain visible with their local history but cannot send until upgraded by their original owner. The explicit upgrade keeps the Space ID/history, creates fresh managed membership and a new key, and requires other members to join again. Legacy `LFCSPACE1` invitations no longer auto-join.

## Security and recovery boundaries

### Channels and moderator permissions

Every Space starts with `#algemeen` (stable ID `general`). The owner can create, rename, change topics, archive and restore channels. Archived channels retain local history but reject new messages. The default channel cannot be archived. Channel IDs are authenticated in each encrypted Space message and persisted with local messages; renaming never changes a channel's identity. Messages without a channel ID remain in the default channel. Drafts and visible history are separated by Space and channel.

The owner can promote/demote a current member account. Moderators can manage channels, but cannot assign roles, alter membership, issue/revoke invitations, or take ownership. The role applies to that account's current approved member devices. Channel changes from moderators are durable, encrypted requests to the pinned owner device; the UI shows pending/rejected/applied, not optimistic success. The owner must be online to validate the current role and sign/broadcast the new configuration.

Every moderator assignment gets a fresh permission nonce. Demotion/removal and re-promotion cannot revive an old command. Owner-issued outcomes are correlated to local pending commands. Commands are idempotent, scoped to the Space and current member device, and channel edits include an expected channel version to reject delayed overwrites. Role/configuration updates advance the signed revision without rotating the membership key; actual joins/removals still rotate keys and preserve channel configuration. Removed accounts lose their roles.

All channels use the Space's member group key: **every Space member can read every channel**. These are conversation organization, not private channels or per-channel access-control groups. Archiving is not remote deletion or erasure. Message deletion/pinning, private channels and arbitrary custom permissions are not part of these moderator capabilities.

Signed managed-Space documents created before channels/roles were added still verify unchanged, with one implicit `#algemeen` and no moderators. The first owner configuration update materializes those fields without resetting the Space ID, keys or history. Use updated clients: older browser versions may flatten channels or be unable to process moderator commands.

Membership is a signed, monotonically versioned owner-device document binding a fresh epoch/key digest and exact member certificates. Receivers pin the owner's signing/encryption identity and reject changed authorities, conflicting or stale revisions, unknown sender devices and obsolete message epochs. An update cannot revive a cancelled/left/removed membership without a fresh explicit join request.

The authority is deliberately pinned to the original owner device, not any device that claims the same account. Owner-device loss/replacement, authority transfer and cross-device key recovery are not implemented here. Do not claim Discord feature parity or production-audited group cryptography.

Admission still requires the owner to approve a request against its current invitation registry. A revoked link can continue to display its signed public preview offline, but cannot be approved. There is no global single-use/use-count guarantee. Offline devices learn revocations when they receive the signed membership update; this is not an instantaneous globally consistent membership service. Old messages and previously shared keys cannot be erased remotely.

Control documents are binary, domain-separated `@leofcoin/binary` values inside authenticated encrypted direct-message envelopes (`contentType: lfc-spaces:1`). The existing binary chat transport carries them; no JSON packet wrapper or chain/consensus protocol change is introduced. Updated browser clients are required for managed Spaces; old clients cannot understand membership controls.

Membership, group keys, invite registries, pending requests and the control outbox are encrypted at rest under the existing local chat-device key, bound to network/account/device. Web Locks serialize same-origin, same-device management writes between tabs. A failed publish leaves a durable outbox, retried while Chat remains open. The transport's existing signed receipts and ciphertext archive handle admitted direct-message delivery; queue admission is not proof of recipient delivery. Acknowledging a membership document means it was processed, not that someone accepted an offer or read a message.

Current bounds are 20 managed Space records per device, eight member devices per Space, 12 channels (including archived channels), 12 pending moderator changes, 20 live invitations, 20 pending join requests and 32 queued control envelopes per Space. Channel names have at most 32 letters/digits/hyphens/underscores and topics at most 120 characters. These limits keep membership updates within the 12 KB control payload and 32 KB chat-packet limits; tests exercise the maximum roster, moderator assignments and channel/topic sizes together. Leave/cancel and use **Forget Space on this device** to free inactive records after their queue drains. Group-message offline replay, attachments, notifications/mentions and broader social features remain separate work.

## Verification

`npm test -w @leofcoin/node` covers signed/expired/forged/revoked invitations, explicit admission/cancellation/denial, authority pinning, key rotation, ciphertext persistence/restart/replay, channel binding/archive/restore, permission revocation, stale edits, document upgrades and binary transport using simulated peers. The opt-in Chrome suite also creates two isolated browser identities and exercises the actual UI, IndexedDB/device keys, encrypted transport, approval, moderator promotion/demotion, delayed channel authorization, channel history/drafts, archive/restore and confirmed member removal. It does not contact the live network or use real wallets.
