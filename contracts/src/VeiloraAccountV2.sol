// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VeiloraAccount.sol";

/**
 * @title VeiloraAccountV2
 * @notice V2 keeps the 2-of-3 account interface and binds each execution
 *         signature to this account address as well as the chain.
 */
contract VeiloraAccountV2 is VeiloraAccount {
    constructor(address _entryPoint, address _shardA, address _shardB, address _shardC)
        VeiloraAccount(_entryPoint, _shardA, _shardB, _shardC)
    {}

    function _executionDigest(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 _nonce,
        uint256 deadline
    ) internal view override returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("VeiloraExecutionV2(address account,address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)"),
                address(this),
                target,
                value,
                keccak256(data),
                _nonce,
                deadline,
                block.chainid
            )
        );
    }
}
