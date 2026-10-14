export const veiloraFactoryAbi = [
  {
    inputs: [{ internalType: "address", name: "_entryPoint", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: false, internalType: "address", name: "shardA", type: "address" },
      { indexed: false, internalType: "address", name: "shardB", type: "address" },
      { indexed: false, internalType: "address", name: "shardC", type: "address" },
    ],
    name: "AccountCreated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "shardA", type: "address" },
      { internalType: "address", name: "shardB", type: "address" },
      { internalType: "address", name: "shardC", type: "address" },
      { internalType: "uint256", name: "salt", type: "uint256" },
    ],
    name: "createAccount",
    outputs: [{ internalType: "address", name: "accountAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "entryPoint",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "shardA", type: "address" },
      { internalType: "address", name: "shardB", type: "address" },
      { internalType: "address", name: "shardC", type: "address" },
      { internalType: "uint256", name: "salt", type: "uint256" },
    ],
    name: "getAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// V2 has the same factory interface; its CREATE2 init code uses V2 account code.
export const veiloraFactoryV2Abi = veiloraFactoryAbi;

export const veiloraAccountAbi = [
  {
    inputs: [
      { internalType: "address", name: "_entryPoint", type: "address" },
      { internalType: "address", name: "_shardA", type: "address" },
      { internalType: "address", name: "_shardB", type: "address" },
      { internalType: "address", name: "_shardC", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "ExecutionFailed", type: "error" },
  { inputs: [], name: "ExpiredDeadline", type: "error" },
  { inputs: [], name: "InvalidNonce", type: "error" },
  { inputs: [], name: "InvalidSignatureLength", type: "error" },
  { inputs: [], name: "InvalidSignerCount", type: "error" },
  { inputs: [], name: "OnlyAuthorized", type: "error" },
  { inputs: [], name: "QuorumNotMet", type: "error" },
  { inputs: [], name: "SignatureVerificationFailed", type: "error" },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: "uint256", name: "operationsCount", type: "uint256" }],
    name: "BatchExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "target", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
      { indexed: false, internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "Executed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Received",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "oldShard", type: "address" },
      { indexed: true, internalType: "address", name: "newShard", type: "address" },
      { indexed: false, internalType: "uint8", name: "shardIndex", type: "uint8" },
    ],
    name: "ShardRotated",
    type: "event",
  },
  {
    inputs: [],
    name: "CHAIN_ID",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "THRESHOLD",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "entryPoint",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
      { internalType: "uint256", name: "_nonce", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "bytes", name: "signatures", type: "bytes" },
    ],
    name: "executeWithSignatures",
    outputs: [{ internalType: "bytes", name: "result", type: "bytes" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "isOwner",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nonce",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newShardA", type: "address" }],
    name: "rotateShardA",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newShardC", type: "address" }],
    name: "rotateShardC",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "shardA",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "shardB",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "shardC",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "userOpHash", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "validateUserOpSignature",
    outputs: [{ internalType: "uint256", name: "validationData", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// VeiloraAccountV2 preserves the account interface while changing its digest domain.
export const veiloraAccountV2Abi = veiloraAccountAbi;

