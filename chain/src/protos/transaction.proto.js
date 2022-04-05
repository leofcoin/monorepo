export default `

message TransactionMessage {
  required uint64 timestamp = 1;
  required string from = 2;
  required string to = 3;
  required string method = 4;
  repeated string params = 5;
}
`
