export default `

message Validators {
  required string address = 1;
  required string reward = 2;
}

message BlockMessage {
  required uint64 index = 1;
  required string previousHash = 3;
  required uint64 timestamp = 4;
  required string reward = 5;
  required string fees = 6;
  repeated string transactions = 7;
  repeated Validators validators = 8;
}
`
