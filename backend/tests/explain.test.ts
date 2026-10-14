import { afterAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, getAddress, maxUint256, parseAbi, parseUnits, type Hex } from "viem";
import { app } from "../src/app";
import { explainCall, explainChain, explainTransaction } from "../src/txExplain";

const wallet = getAddress("0x1111111111111111111111111111111111111111");
const friend = getAddress("0x2222222222222222222222222222222222222222");
const relayer = getAddress("0x3333333333333333333333333333333333333333");
const USDG = getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const NVDA = getAddress("0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC");
const ROUTER = getAddress("0xcaf681a66d020601342297493863e78c959e5cb2");
const abi = parseAbi([
  "function transfer(address to,uint256 amount) returns (bool)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function executeWithSignatures(address target,uint256 value,bytes data,uint256 _nonce,uint256 deadline,bytes signatures) returns (bytes)",
  "function rotateShardA(address newShardA)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const codes = (e: { flags: { code: string }[] }) => e.flags.map((f) => f.code);
const swapData = (recipient = wallet) => encodeFunctionData({ abi, functionName: "multicall", args: [1_900_000_000n, [encodeFunctionData({ abi, functionName: "exactInputSingle",
  args: [{ tokenIn: USDG, tokenOut: NVDA, fee: 3000, recipient, amountIn: parseUnits("100", 6), amountOutMinimum: parseUnits("0.42", 18), sqrtPriceLimitX96: 0n }] })]] });

describe("explaining calls before signing", () => {
  test("plain ETH and token sends", () => {
    const eth = explainCall(wallet, { target: friend, value: parseUnits("0.5", 18), data: "0x" });
    expect(eth.kind).toBe("send");
    expect(eth.title).toBe("Send 0.5 ETH");
    const usdg = explainCall(wallet, { target: USDG, value: 0n, data: encodeFunctionData({ abi, functionName: "transfer", args: [friend, parseUnits("25", 6)] }) });
    expect(usdg.title).toBe("Send 25 USDG");
    expect(usdg.effects[0]).toMatchObject({ direction: "out", asset: "USDG", amount: "25", counterparty: friend });
  });

  test("flags unlimited approvals and unknown spenders, but not a limited router approval", () => {
    const limited = explainCall(wallet, { target: USDG, value: 0n, data: encodeFunctionData({ abi, functionName: "approve", args: [ROUTER, parseUnits("100", 6)] }) });
    expect(codes(limited)).toEqual(["limited-approval"]);
    const unlimited = explainCall(wallet, { target: USDG, value: 0n, data: encodeFunctionData({ abi, functionName: "approve", args: [friend, maxUint256] }) });
    expect(codes(unlimited)).toEqual(["unlimited-approval", "unknown-spender"]);
    expect(unlimited.effects[0].amount).toBe("unlimited");
  });

  test("decodes a Uniswap v3 swap and flags output going to someone else", () => {
    const swap = explainCall(wallet, { target: ROUTER, value: 0n, data: swapData() });
    expect(swap.kind).toBe("swap");
    expect(swap.title).toBe("Swap 100 USDG for NVDA");
    expect(swap.effects[1]).toMatchObject({ direction: "in", asset: "NVDA", amount: "≥ 0.42" });
    expect(codes(swap)).toEqual(["min-out", "pool-fee"]);
    expect(codes(explainCall(wallet, { target: ROUTER, value: 0n, data: swapData(friend) }))).toContain("foreign-recipient");
  });

  test("flags signer changes and calls it cannot decode", () => {
    const rotate = explainCall(wallet, { target: wallet, value: 0n, data: encodeFunctionData({ abi, functionName: "rotateShardA", args: [friend] }) });
    expect(rotate.kind).toBe("shard-change");
    expect(codes(rotate)).toEqual(["signer-change"]);
    const unknown = explainCall(wallet, { target: friend, value: 1n, data: "0xdeadbeef" });
    expect(unknown.kind).toBe("contract-call");
    expect(unknown.flags[0].level).toBe("danger");
  });

  test("POST /v1/explain reports the most severe level across calls", async () => {
    const res = await request(app).post("/v1/explain").send({ walletAddress: wallet, calls: [
      { target: USDG, value: "0", data: encodeFunctionData({ abi, functionName: "approve", args: [ROUTER, parseUnits("100", 6)] }) },
      { target: ROUTER, value: "0", data: swapData() },
    ] });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe("info");
    expect(res.body.explanations).toHaveLength(2);
    expect((await request(app).post("/v1/explain").send({ walletAddress: wallet, calls: [] })).status).toBe(400);
  });
});

describe("explaining mined transactions", () => {
  const realTx = explainChain.getTransaction;
  const realReceipt = explainChain.getReceipt;
  afterAll(() => { explainChain.getTransaction = realTx; explainChain.getReceipt = realReceipt; });
  const hash = `0x${"aa".repeat(32)}` as Hex;
  const transferLog = (token: string, from: string, to: string, value: bigint) => ({
    address: token,
    topics: encodeEventTopics({ abi, eventName: "Transfer", args: { from: from as Hex, to: to as Hex } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  });
  function mock(tx: Record<string, unknown>, receipt: Record<string, unknown>) {
    explainChain.getTransaction = (async () => ({ value: 0n, input: "0x", ...tx })) as any;
    explainChain.getReceipt = (async () => ({ status: "success", gasUsed: 100_000n, effectiveGasPrice: 10_000_000n, logs: [], ...receipt })) as any;
  }

  test("a relayed swap shows what actually moved and that the relayer paid gas", async () => {
    mock({ from: relayer, to: wallet, input: encodeFunctionData({ abi, functionName: "executeWithSignatures", args: [ROUTER, 0n, swapData(), 4n, 1_900_000_000n, `0x${"11".repeat(130)}`] }) },
      { logs: [transferLog(USDG, wallet, ROUTER, parseUnits("100", 6)), transferLog(NVDA, ROUTER, wallet, parseUnits("0.43", 18))] });
    const e = await explainTransaction(wallet, hash);
    expect(e.kind).toBe("swap");
    expect(e.gasPaidBy).toBe("relayer");
    expect(e.effects.slice(0, 2)).toEqual([
      { direction: "out", asset: "USDG", amount: "100", raw: parseUnits("100", 6).toString(), counterparty: ROUTER },
      { direction: "in", asset: "NVDA", amount: "0.43", raw: parseUnits("0.43", 18).toString(), counterparty: ROUTER },
    ]);
    expect(codes(e)).toContain("gas-sponsored");
  });

  test("an incoming token transfer is a free receive", async () => {
    mock({ from: friend, to: USDG, input: encodeFunctionData({ abi, functionName: "transfer", args: [wallet, parseUnits("40", 6)] }) },
      { logs: [transferLog(USDG, friend, wallet, parseUnits("40", 6))] });
    const e = await explainTransaction(wallet, hash);
    expect(e.kind).toBe("receive");
    expect(e.title).toBe("Received 40 USDG");
  });

  test("a reverted transaction reports that nothing moved", async () => {
    mock({ from: relayer, to: wallet, input: encodeFunctionData({ abi, functionName: "executeWithSignatures", args: [ROUTER, 0n, swapData(), 4n, 1_900_000_000n, `0x${"11".repeat(130)}`] }) },
      { status: "reverted" });
    const e = await explainTransaction(wallet, hash);
    expect(e.status).toBe("reverted");
    expect(e.effects).toEqual([]);
    expect(e.flags[0].code).toBe("reverted");
  });

  test("GET /v1/wallets/:address/explain/:hash validates input", async () => {
    expect((await request(app).get(`/v1/wallets/${wallet}/explain/0x1234`)).status).toBe(400);
  });
});
