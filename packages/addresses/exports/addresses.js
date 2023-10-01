var contractFactory$1 = "IHNY2GQHKQLQTSDQ5CRDWDDILC34U5LGP4ONJESURDTOZ3NZWJZ3KEUGCVU";
var nativeToken$1 = "IHNY2GQHOWEK5XEJR6YZ4XPSDULCLQOZRXLOYKMFX74XKN7SITELRHXFCOD";
var nameService$1 = "IHNY2GQHP5YDJUJBGFFGP72EO5L2V76O53VI6PRPO4MJTMY4AQGJTZBQSQM";
var validators$1 = "IHNY2GQGQXEN26APPGH7PF72BZVT6HPSKWCO3KWRIUMEKCKEFLNV3GUNGIJ";
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
