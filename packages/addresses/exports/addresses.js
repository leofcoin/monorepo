var contractFactory$1 = "IHNY2GQGYO6BDXHHL2KHK3KQU353HPCARUVAP2UVWH4EUVV4JXT373KSVF2";
var nativeToken$1 = "IHNY2GQH3C44RRUDM4XLG67KHHS3UER7L6NULDHH6ACVOAVTLAGBRLB5BSJ";
var nameService$1 = "IHNY2GQH5BUXSQTSUP32R7TFOPN3HDWKL4TT2G7MJANULBRN7WHZ4ANG4DH";
var validators$1 = "IHNY2GQHFKTVEBJGRT6XGHR434KWLGDHOVEI4OB6UK7QUKCNOICMVTXRWTS";
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
