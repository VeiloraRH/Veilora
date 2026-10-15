// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VeiloraEscrowV2.sol";

/** @notice CREATE2 factory for evaluator-protected Veilora V2 job escrows. */
contract VeiloraEscrowFactoryV2 {
    uint32 public constant FACTORY_VERSION = 2;
    mapping(address escrow => bool verified) public isEscrow;

    event EscrowCreated(bytes32 indexed jobId, address indexed escrow, bytes32 indexed termsHash);

    function predictEscrow(VeiloraEscrowV2.Terms calldata terms) public view returns (address) {
        if (terms.factoryVersion != FACTORY_VERSION) revert("unsupported factory version");
        bytes32 salt = keccak256(abi.encode(terms));
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(VeiloraEscrowV2).creationCode, abi.encode(terms))
        );
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash))))
        );
    }

    function create(VeiloraEscrowV2.Terms calldata terms) external returns (address escrow) {
        escrow = predictEscrow(terms);
        if (escrow.code.length == 0) {
            bytes32 salt = keccak256(abi.encode(terms));
            escrow = address(new VeiloraEscrowV2{salt: salt}(terms));
            emit EscrowCreated(terms.jobId, escrow, VeiloraEscrowV2(payable(escrow)).termsHash());
        }
        isEscrow[escrow] = true;
    }
}
