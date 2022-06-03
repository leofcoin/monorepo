export default `

message TransactionMessage {
  required uint64 timestamp = 1;
  required string from = 2;
  required string to = 3;
  required uint64 nonce = 4;
  required string method = 5;
  repeated string params = 6;
}
`
