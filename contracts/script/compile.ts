import solc from "solc";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const sourceFiles = [
  "contracts/src/VeiloraAccount.sol",
  "contracts/src/VeiloraFactory.sol",
  "contracts/src/VeiloraEscrow.sol",
  "contracts/src/VeiloraEscrowFactory.sol",
];
const sources = Object.fromEntries(
  sourceFiles.map((path) => [path, { content: readFileSync(join(root, path), "utf8") }]),
);
const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: Array<{ severity: string; formattedMessage: string }>;
  contracts?: Record<string, Record<string, {
    abi: unknown[];
    evm: { bytecode: { object: string }; deployedBytecode: { object: string } };
  }>>;
};
const errors = output.errors ?? [];
for (const error of errors) console[error.severity === "error" ? "error" : "warn"](error.formattedMessage);
if (errors.some((error) => error.severity === "error") || !output.contracts) process.exit(1);

const out = join(root, "contracts/out");
mkdirSync(out, { recursive: true });
for (const [source, contracts] of Object.entries(output.contracts)) {
  const prefix = source.replaceAll("/", "_").replaceAll(".", "_");
  for (const [name, artifact] of Object.entries(contracts)) {
    const basename = `${prefix}_${name}`;
    writeFileSync(join(out, `${basename}.abi`), JSON.stringify(artifact.abi, null, 2));
    writeFileSync(join(out, `${basename}.bin`), artifact.evm.bytecode.object);
    writeFileSync(join(out, `${basename}.runtime.bin`), artifact.evm.deployedBytecode.object);
  }
}
console.log(`Compiled ${Object.values(output.contracts).reduce((sum, contracts) => sum + Object.keys(contracts).length, 0)} contracts into contracts/out.`);
