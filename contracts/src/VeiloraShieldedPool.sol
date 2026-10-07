// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title VeiloraShieldedPool
 * @notice Shielded Note Deposit & Withdrawal Pool for Robinhood Chain (4663)
 * @dev Stores UTXO commitments and nullifier hashes to prevent double-spending.
 */
contract VeiloraShieldedPool {
    address public immutable usdgToken;

    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierSpent;

    uint32 public nextLeafIndex;

    event Deposit(bytes32 indexed commitment, address indexed token, uint256 amount, uint32 leafIndex);
    event Unshield(bytes32 indexed nullifierHash, address indexed recipient, uint256 amount);

    error NullifierAlreadySpent();
    error InvalidCommitment();
    error TransferFailed();

    constructor(address _usdgToken) {
        usdgToken = _usdgToken;
    }

    /**
     * @notice Shield public USDG into a private note commitment
     */
    function depositUSDG(bytes32 commitment, uint256 amount) external {
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (commitments[commitment]) revert InvalidCommitment();

        commitments[commitment] = true;
        uint32 leafIndex = nextLeafIndex++;

        bool success = IERC20(usdgToken).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        emit Deposit(commitment, usdgToken, amount, leafIndex);
    }

    /**
     * @notice Unshield private note back into public USDG with nullifier
     */
    function unshieldUSDG(
        bytes32 nullifierHash,
        address recipient,
        uint256 amount
    ) external {
        if (nullifierSpent[nullifierHash]) revert NullifierAlreadySpent();

        nullifierSpent[nullifierHash] = true;

        bool success = IERC20(usdgToken).transfer(recipient, amount);
        if (!success) revert TransferFailed();

        emit Unshield(nullifierHash, recipient, amount);
    }
}
