# Release Notes

Release date: 2026-04-15  
Branch: fix-machine-states

## Summary
This release publishes consensus, sync hardening, and package dependency/version alignment updates across the monorepo. It includes a chain patch release and coordinated package updates required by the fix-machine-states work.

## Published Packages
1. @leofcoin/chain 1.9.3
2. @leofcoin/addresses 1.0.56
3. @leofcoin/contracts 0.1.17
4. @leofcoin/errors 1.0.26
5. @leofcoin/globals 1.0.23
6. @vandeurenglenn/doc-it 1.0.32
7. @leofcoin/lib 1.2.75
8. @leofcoin/messages 1.4.41
9. @leofcoin/mnemonic 1.0.33
10. @leofcoin/networks 1.1.26
11. @leofcoin/types 1.0.23
12. @leofcoin/utils 1.1.41
13. @leofcoin/wallet 1.0.18
14. @leofcoin/workers 1.5.28

## Highlights
1. Consensus and sync safeguards improved in chain and state runtime flows.
2. Peer/version handling and sync failure signaling were tightened to avoid silent incompatibility paths.
3. Release set includes aligned dependency bumps consumed by chain and related workspaces.
4. Genesis script now supports explicit password input.

## Notes
1. Chain package was published as 1.9.3 because 1.9.2 already existed on npm.
2. Registry propagation may briefly lag immediately after publish, but final checks confirmed availability.
