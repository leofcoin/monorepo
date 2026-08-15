# monorepo

## Local validator

After building the workspace and creating genesis credentials, run the local `peach` validator with:

```sh
npm run validator
```

It loads `genesis-credentials/leofcoin-peach/genesis-password.txt`, activates validator participation, and submits one minimal self-transfer every five minutes. Override the credential path or interval with `LEOFCOIN_PASSWORD_FILE` and `LEOFCOIN_TRANSACTION_INTERVAL_MINUTES`. Never commit either the password or identity backup.
