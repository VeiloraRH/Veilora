// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VeiloraAccountV2.sol";

/** @notice CREATE2 factory for Veilora V2 threshold accounts. */
contract VeiloraFactoryV2 {
    address public immutable entryPoint;

    event AccountCreated(address indexed account, address shardA, address shardB, address shardC);

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    function getAddress(address shardA, address shardB, address shardC, uint256 salt) public view returns (address) {
        bytes32 finalSalt = keccak256(abi.encodePacked(shardA, shardB, shardC, salt));
        bytes memory bytecode = abi.encodePacked(
            type(VeiloraAccountV2).creationCode,
            abi.encode(entryPoint, shardA, shardB, shardC)
        );
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), finalSalt, keccak256(bytecode)));
        return address(uint160(uint256(hash)));
    }

    function createAccount(address shardA, address shardB, address shardC, uint256 salt) external returns (address accountAddress) {
        accountAddress = getAddress(shardA, shardB, shardC, salt);
        if (accountAddress.code.length > 0) return accountAddress;

        bytes32 finalSalt = keccak256(abi.encodePacked(shardA, shardB, shardC, salt));
        VeiloraAccountV2 deployed = new VeiloraAccountV2{salt: finalSalt}(entryPoint, shardA, shardB, shardC);
        emit AccountCreated(address(deployed), shardA, shardB, shardC);
        return address(deployed);
    }
}
