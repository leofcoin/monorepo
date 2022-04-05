export default `
message ContractMessage {
  required string creator = 1;
  required bytes contract = 2;
  repeated string constructorParameters = 3;
}
`
