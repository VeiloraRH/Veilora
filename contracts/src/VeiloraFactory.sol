// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VeiloraAccount.sol";

/**
 * @title VeiloraFactory
 * @notice Deterministic CREATE2 factory for Veilora 2-of-3 Threshold Smart Accounts
 */
contract VeiloraFactory {
    address public immutable entryPoint;

    event AccountCreated(address indexed account, address shardA, address shardB, address shardC);

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    /**
     * @notice Computes deterministic address for an account before deployment
     */
    function getAddress(
        address shardA,
        address shardB,
        address shardC,
        uint256 salt
    ) public view returns (address) {
        bytes32 finalSalt = keccak256(abi.encodePacked(shardA, shardB, shardC, salt));
        bytes memory bytecode = abi.encodePacked(
            type(VeiloraAccount).creationCode,
            abi.encode(entryPoint, shardA, shardB, shardC)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), finalSalt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Deploys account using CREATE2
     */
    function createAccount(
        address shardA,
        address shardB,
        address shardC,
        uint256 salt
    ) external returns (address accountAddress) {
        accountAddress = getAddress(shardA, shardB, shardC, salt);

        if (accountAddress.code.length > 0) {
            return accountAddress;
        }

        bytes32 finalSalt = keccak256(abi.encodePacked(shardA, shardB, shardC, salt));
        VeiloraAccount newAccount = new VeiloraAccount{salt: finalSalt}(
            entryPoint,
            shardA,
            shardB,
            shardC
        );

        emit AccountCreated(address(newAccount), shardA, shardB, shardC);
        return address(newAccount);
    }
}
