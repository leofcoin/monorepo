export default `
message ValidatorMessage {
  required string address = 1;
  required string reward = 2;
}

message Transaction {
  required string hash = 1;
  required uint64 timestamp = 2;
  required string from = 3;
  required string to = 4;
  required uint64 nonce = 5;
  required string method = 6;
  repeated string params = 7;
}

message BlockMessage {
  required uint64 index = 1;
  required string previousHash = 3;
  required uint64 timestamp = 4;
  required uint64 reward = 5;
  required string fees = 6;
  repeated Transaction transactions = 7;
  repeated ValidatorMessage validators = 8;
}
`
