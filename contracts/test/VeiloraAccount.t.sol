// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VeiloraAccount} from "../src/VeiloraAccount.sol";
import {VeiloraFactory} from "../src/VeiloraFactory.sol";
import {VeiloraShieldedPool} from "../src/VeiloraShieldedPool.sol";

interface Vm {
    function prank(address) external;
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function addr(uint256) external returns (address);
    function warp(uint256) external;
}

// Minimal forge-compatible test base interface
abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed: expected true");
    }

    function assertFalse(bool condition) internal pure {
        require(!condition, "Assertion failed: expected false");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "Assertion failed: uint256 mismatch");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "Assertion failed: address mismatch");
    }
}

contract MockTarget {
    uint256 public value;
    event TargetCalled(uint256 newValue);

    function setValue(uint256 _value) external payable {
        value = _value;
        emit TargetCalled(_value);
    }
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract VeiloraAccountTest is TestBase {
    VeiloraAccount public account;
    VeiloraFactory public factory;
    VeiloraShieldedPool public pool;
    MockTarget public target;
    MockERC20 public mockUSDG;

    address public entryPoint = address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);

    uint256 internal privateKeyA = 0xA11CE;
    uint256 internal privateKeyB = 0xB0B;
    uint256 internal privateKeyC = 0xCAFE;
    uint256 internal strangerKey = 0xBAD;

    address public shardA;
    address public shardB;
    address public shardC;
    address public stranger;

    function setUp() public {
        shardA = vm.addr(privateKeyA);
        shardB = vm.addr(privateKeyB);
        shardC = vm.addr(privateKeyC);
        stranger = vm.addr(strangerKey);

        factory = new VeiloraFactory(entryPoint);
        account = new VeiloraAccount(entryPoint, shardA, shardB, shardC);
        target = new MockTarget();
        mockUSDG = new MockERC20();
        pool = new VeiloraShieldedPool(address(mockUSDG));
    }

    function test_Initialization() public view {
        assertEq(account.shardA(), shardA);
        assertEq(account.shardB(), shardB);
        assertEq(account.shardC(), shardC);
        assertEq(account.THRESHOLD(), 2);
        assertEq(account.entryPoint(), entryPoint);
        assertEq(account.CHAIN_ID(), 4663);
        assertEq(account.nonce(), 0);
    }

    function test_OwnerCheck() public view {
        assertTrue(account.isOwner(shardA));
        assertTrue(account.isOwner(shardB));
        assertTrue(account.isOwner(shardC));
        assertFalse(account.isOwner(stranger));
    }

    function _sign(uint256 privateKey, bytes32 hash) internal returns (bytes memory) {
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function test_ExecuteWithSignatures_Success_ShardA_and_ShardB() public {
        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, 42);
        uint256 deadline = block.timestamp + 3600;
        uint256 currentNonce = account.nonce();

        bytes32 digest = keccak256(
            abi.encode(
                keccak256("VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)"),
                address(target),
                0,
                keccak256(callData),
                currentNonce,
                deadline,
                block.chainid
            )
        );

        bytes memory sigA = _sign(privateKeyA, digest);
        bytes memory sigB = _sign(privateKeyB, digest);
        bytes memory combinedSignatures = abi.encodePacked(sigA, sigB);

        // Stranger broadcasts (acting as Relayer)
        vm.prank(stranger);
        account.executeWithSignatures(address(target), 0, callData, currentNonce, deadline, combinedSignatures);

        assertEq(target.value(), 42);
        assertEq(account.nonce(), currentNonce + 1);
    }

    function test_ExecuteWithSignatures_Success_Recovery_ShardB_and_ShardC() public {
        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, 999);
        uint256 deadline = block.timestamp + 3600;
        uint256 currentNonce = account.nonce();

        bytes32 digest = keccak256(
            abi.encode(
                keccak256("VeiloraExecution(address target,uint256 value,bytes data,uint256 nonce,uint256 deadline,uint256 chainId)"),
                address(target),
                0,
                keccak256(callData),
                currentNonce,
                deadline,
                block.chainid
            )
        );

        bytes memory sigB = _sign(privateKeyB, digest);
        bytes memory sigC = _sign(privateKeyC, digest);
        bytes memory combinedSignatures = abi.encodePacked(sigB, sigC);

        vm.prank(stranger);
        account.executeWithSignatures(address(target), 0, callData, currentNonce, deadline, combinedSignatures);

        assertEq(target.value(), 999);
    }

    function test_DeterministicFactory_ComputesAddress() public {
        uint256 salt = 12345;
        address predicted = factory.getAddress(shardA, shardB, shardC, salt);
        address deployed = factory.createAccount(shardA, shardB, shardC, salt);
        assertEq(predicted, deployed);
    }

    function test_ShieldedPool_DepositAndUnshield() public {
        bytes32 commitment = keccak256("note:usdg:100:secret");
        bytes32 nullifier = keccak256("nullifier:note:usdg:100");

        mockUSDG.mint(address(this), 1000);
        mockUSDG.approve(address(pool), 1000);

        // 1. Deposit
        pool.depositUSDG(commitment, 100);
        assertTrue(pool.commitments(commitment));
        assertEq(pool.nextLeafIndex(), 1);

        // 2. Unshield
        address recipient = address(0x5555);
        pool.unshieldUSDG(nullifier, recipient, 100);
        assertTrue(pool.nullifierSpent(nullifier));
        assertEq(mockUSDG.balanceOf(recipient), 100);
    }
}
