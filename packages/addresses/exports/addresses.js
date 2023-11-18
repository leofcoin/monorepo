var contractFactory$1 = "IHNY2GQGRJLJFW3A63ARJ2CTBM5YIPJ4FVYAVVPFSMZQXZKLWCOOFG4JXJ7";
var nativeToken$1 = "IHNY2GQG5OT6QRA2QKMBLSO7GAEDDZWEZXVQ2KG2DWHXOIZGAR7G4EMWGDU";
var nameService$1 = "IHNY2GQGAZWW3SF533PCH6EEOAQXOUP3SAGAMNERKAHCYRK4IK7XA3BLWI3";
var validators$1 = "IHNY2GQHA6EGTFFD5SF66GIXT6M6WDQBHC7CAVOUA2SUKFORF5UEEG3SPY4";
var addresses$1 = {
	contractFactory: contractFactory$1,
	nativeToken: nativeToken$1,
	nameService: nameService$1,
	validators: validators$1
};

const contractFactory = addresses$1.contractFactory;
const nameService = addresses$1.nameService;
const nativeToken = addresses$1.nativeToken;
const validators = addresses$1.validators;
var addresses = {
  contractFactory,
  nameService,
  nativeToken,
  validators
};

export { contractFactory, addresses as default, nameService, nativeToken, validators };
