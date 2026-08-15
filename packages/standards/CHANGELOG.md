# @leofcoin/standards

## 0.3.5

### Changed

- Removed types definitions from exports directory for cleaner package structure

## 0.3.4

### Changed

- Removed unused interfaces.ts file
- Updated rollup configuration

## 0.3.3

### Changed

- Refactored type exports and moved interfaces to source files

## 0.3.2

### Changed

- Refactored type imports to use new interfaces module

## 0.3.1

### Changed

- Updated voting type definitions and dependencies

## 0.3.0

### Changed

- Refactored TokenReceiver to use native `bigint` instead of `BigNumber`
- Updated comparison operators to use native BigInt comparisons (`>=`, `>`, `===`)

### Added

- GitHub Actions workflow for automated testing across Node.js versions 22.x and latest
- Test status badge in README
- Comprehensive unit tests for helpers, roles, token, and voting modules
- Meta base class for state management

### Fixed

- Test script glob pattern in package.json
- Build step added to CI workflow for proper test execution

## 0.2.1

### Patch Changes

- 6073f7d: interface/public-voting -> interfaces/i-public-voting

## 0.2.0

### Minor Changes

- Add voting & tokenReceiver
