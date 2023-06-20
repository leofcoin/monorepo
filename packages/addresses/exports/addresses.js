var contractFactory$1 = "IHNY2GQHKD3V4U2EF6P4TIHJNRQNDJ3N3AVXV6YGD6F2T3CNLMXWFU2LAC5";
var nativeToken$1 = "IHNY2GQHXGQL4URICKLN5SE5ULIPF2QSFWU3DP4GZFOA5DBX4MMVDKJ2I3M";
var nameService$1 = "IHNY2GQHZF3V4WIARWW7R2V4BDWWETJEN5QFITSTVIBWJFBZSD4ZBOSDNS4";
var validators$1 = "IHNY2GQHJNPTBQQVFOPOCU6YG6SZMBEGXL5G2O6MTSK4PU7PGU7C7SG4PPY";
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
