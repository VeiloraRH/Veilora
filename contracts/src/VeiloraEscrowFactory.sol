// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VeiloraEscrow.sol";

/** @notice CREATE2 factory for immutable Veilora job escrows. */
contract VeiloraEscrowFactory {
    uint32 public constant FACTORY_VERSION = 1;
    mapping(address escrow => bool verified) public isEscrow;

    event EscrowCreated(bytes32 indexed jobId, address indexed escrow, bytes32 indexed termsHash);

    function predictEscrow(VeiloraEscrow.Terms calldata terms) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(terms));
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(VeiloraEscrow).creationCode, abi.encode(terms))
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }

    function create(VeiloraEscrow.Terms calldata terms) external returns (address escrow) {
        if (terms.factoryVersion != FACTORY_VERSION) revert("unsupported factory version");
        escrow = predictEscrow(terms);
        if (escrow.code.length == 0) {
            bytes32 salt = keccak256(abi.encode(terms));
            escrow = address(new VeiloraEscrow{salt: salt}(terms));
            emit EscrowCreated(terms.jobId, escrow, VeiloraEscrow(payable(escrow)).termsHash());
        }
        isEscrow[escrow] = true;
    }
}
