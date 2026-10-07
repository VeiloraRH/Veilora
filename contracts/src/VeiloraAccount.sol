// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VeiloraAccount
 * @notice 2-of-3 Threshold Smart Vault with Dual Execution:
 *         1. Standard ERC-4337 EntryPoint hook (validateUserOp)
 *         2. Native Relayer execution hook (executeWithSignatures) for chains without bundlers (e.g. Robinhood Chain 4663)
 */
contract VeiloraAccount {
    // 3 Authorized Shard Keys
    address public shardA; // Client device shard
    address public shardB; // Co-signer server shard
    address public shardC; // Recovery / Passkey shard

    uint256 public constant THRESHOLD = 2;
    uint256 public constant CHAIN_ID = 4663; // Robinhood Chain Mainnet

    address public immutable entryPoint;
    uint256 public nonce;

    event Executed(address indexed target, uint256 value, bytes data);
    event BatchExecuted(uint256 operationsCount);
    event Received(address indexed sender, uint256 amount);
    event ShardRotated(address indexed oldShard, address indexed newShard, uint8 shardIndex);

    error OnlyAuthorized();
    error InvalidSignerCount();
    error InvalidSignatureLength();
    error SignatureVerificationFailed();
    error QuorumNotMet();
    error ExecutionFailed();
    error ExpiredDeadline();
    error InvalidNonce();

    modifier onlyAuthorized() {
        if (msg.sender != entryPoint && msg.sender != address(this)) revert OnlyAuthorized();
        _;
    }

    constructor(address _entryPoint, address _shardA, address _shardB, address _shardC) {
        if (_shardA == address(0) || _shardB == address(0) || _shardC == address(0)) {
            revert InvalidSignerCount();
        }
        entryPoint = _entryPoint;
        shardA = _shardA;
        shardB = _shardB;
        shardC = _shardC;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @notice Check if an address is one of the 3 authorized shards
     */
    function isOwner(address account) public view returns (bool) {
        return account == shardA || account == shardB || account == shardC;
    }

    /**
     * @notice Native Relayer Execution Hook
     * @dev Allows our backend relayer to execute actions directly on Robinhood Chain without an ERC-4337 bundler.
     *      Verifies that `signatures` contains two 65-byte ECDSA signatures (130 bytes total) from distinct authorized shards.
     */
    function executeWithSignatures(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 _nonce,
        uint256 deadline,
        bytes calldata signatures
    ) external returns (bytes memory result) {
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (_nonce != nonce) revert InvalidNonce();
        if (signatures.length != 130) revert InvalidSignatureLength();

        // Increment nonce for replay protection
        nonce++;

        // Compute execution digest
        bytes32 digest = keccak256(
            abi.encode(
                keccak256("VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)"),
                target,
                value,
                keccak256(data),
                _nonce,
                deadline,
                block.chainid
            )
        );

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );

        address signer1 = recoverSigner(ethSignedMessageHash, signatures[0:65]);
        address signer2 = recoverSigner(ethSignedMessageHash, signatures[65:130]);

        if (signer1 == signer2 || signer1 == address(0) || signer2 == address(0)) {
            revert SignatureVerificationFailed();
        }

        uint256 validSignatures = 0;
        if (isOwner(signer1)) validSignatures++;
        if (isOwner(signer2)) validSignatures++;

        if (validSignatures < THRESHOLD) revert QuorumNotMet();

        // Execute external call
        bool success;
        (success, result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        emit Executed(target, value, data);
    }

    /**
     * @notice Standard ERC-4337 validateUserOp signature check (for future bundler compatibility)
     */
    function validateUserOpSignature(
        bytes32 userOpHash,
        bytes calldata signature
    ) public view returns (uint256 validationData) {
        if (signature.length != 130) return 1;

        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash)
        );

        address signer1 = recoverSigner(ethSignedMessageHash, signature[0:65]);
        address signer2 = recoverSigner(ethSignedMessageHash, signature[65:130]);

        if (signer1 == signer2 || signer1 == address(0) || signer2 == address(0)) {
            return 1;
        }

        uint256 validSignatures = 0;
        if (isOwner(signer1)) validSignatures++;
        if (isOwner(signer2)) validSignatures++;

        return validSignatures >= THRESHOLD ? 0 : 1;
    }

    /**
     * @notice Standard execute call (via EntryPoint or self)
     */
    function execute(address target, uint256 value, bytes calldata data) external onlyAuthorized {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        emit Executed(target, value, data);
    }

    /**
     * @notice Emergency rotation of Shard A (Device)
     */
    function rotateShardA(address newShardA) external onlyAuthorized {
        if (newShardA == address(0)) revert InvalidSignerCount();
        require(newShardA != shardB && newShardA != shardC, "Duplicate shard");
        address oldShard = shardA;
        shardA = newShardA;
        emit ShardRotated(oldShard, newShardA, 1);
    }

    /**
     * @notice Emergency rotation of Shard C (Passkey)
     */
    function rotateShardC(address newShardC) external onlyAuthorized {
        if (newShardC == address(0)) revert InvalidSignerCount();
        require(newShardC != shardA && newShardC != shardB, "Duplicate shard");
        address oldShard = shardC;
        shardC = newShardC;
        emit ShardRotated(oldShard, newShardC, 3);
    }

    function recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        return ecrecover(hash, v, r, s);
    }
}
